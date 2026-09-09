import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, BrandLockup, Checkbox, ErrorState, LoadingState, StatusBanner, TextField, storybookTheme } from '@/shared/ui';
import {
  createOrganization,
  homePathFor,
  joinClass,
  login,
  signupOrganizationOwner,
  signupParent,
  signupTutor,
  useAuth,
  type UserSummary,
} from '@/entities/auth';
import { messageForError } from '@/shared/api';
import { updateNotificationSettings } from '@/entities/notification-settings';
import {
  acceptTutorInvite,
  acceptTutorInviteByCode,
  previewTutorInvite,
  previewTutorInviteByCode,
  type TutorInvitePreview,
} from '@/entities/tutor';
import {
  EMPTY_TERMS_CONSENT,
  TermsConsent,
  termsConsentIsValid,
  type TermsConsentState,
} from '@/features/terms-consent';
import { SocialLoginButtons } from '@/features/oauth-login';

type OnAuthed = (token: string, user: UserSummary) => void;

type OnboardingRole = 'PARENT' | 'DIRECTOR' | 'TUTOR';
type OnboardingStep =
  | 'welcome'
  | 'value-onboarding'
  | 'role'
  | 'sign-up'
  | 'sign-in'
  | 'tutor-preview'
  | 'tutor-consent';

/** 선생님이 부모에게 보낸 초대(코드 또는 토큰) - previewTutorInvite(By Code)/acceptTutorInvite(By Code)
 * 중 어느 걸 부를지는 isCode로 가른다. */
export type TutorInviteRef = { value: string; isCode: boolean };

/** tutor-consent 단계에서 실제로 acceptTutorInvite(By Code)에 실어 보낼 본문 - 이미 로그인된
 * 계정이면 token 하나, 새 계정이면 가입 필드 전부(백엔드가 계정 생성과 초대 수락을 한 번에 한다). */
type PendingTutorAccept =
  | { kind: 'token'; token: string }
  | { kind: 'new-account'; loginId: string; email: string; password: string; displayName: string; marketing: boolean };

type OnboardingFlowProps = {
  /** HomePage의 원장님/학부모님 역할 카드나 "로그인" 링크에서 곧장 들어올 때 해당 단계로 시작한다. */
  initialStep?: OnboardingStep;
  initialRole?: OnboardingRole;
  /** 이메일 초대 링크나 기관 반코드 딥링크로 들어올 때 - PARENT role로 잠기고 반코드 입력 대신 초대 토큰으로 joinClass를 부른다. */
  initialInvite?: string;
  /** 선생님의 부모 초대(코드/토큰)로 들어올 때 - PARENT role로 잠기고 tutor-preview부터 시작해서
   *  미리보기 → (로그인 또는 가입) → 동의 → 연결 완료까지 이 흐름 안에서 전부 처리한다.
   *  예전엔 /tutor-invite/:token이 ParentLinkAcceptPage라는 별도 화면·스타일·상태머신으로 완전히
   *  분리돼 있었다 - 기관 반코드 매칭(이 컴포넌트 안에 통합돼 있음)과 겪는 경험이 달랐던 걸
   *  하나로 합쳤다. */
  initialTutorInvite?: TutorInviteRef;
  /** "← 처음으로"로 닫을 때 - HomePage가 평소 화면으로 되돌아간다. */
  onExit: () => void;
};

const VALUE_SLIDES = [
  {
    eyebrow: '검수된 이야기',
    title: '아이가 안심하고\n끝까지 듣는 동화',
    body: '작가가 정한 줄거리와 안전한 결말은 지키고, 중요한 순간에만 아이의 생각을 받아요.',
  },
  {
    eyebrow: '아이의 한마디',
    title: '질문도, 추측도,\n해보고 싶은 행동도',
    body: '아이의 말을 먼저 확인한 뒤 짧게 답하거나 장면 안에서 실제 행동으로 보여줘요.',
  },
  {
    eyebrow: '부모와 이어가기',
    title: '무엇을 궁금해했는지\n이야기 뒤에도 남아요',
    body: '점수나 성향 판단 대신 실제 질문과 달라진 장면, 집에서 나눌 대화를 기록해요.',
  },
];

const ROLE_CARDS: Array<{ role: OnboardingRole; eyebrow: string; title: string; description: string }> = [
  { role: 'PARENT', eyebrow: '가정에서', title: '학부모님', description: '아이와 함께 이야기 서재를 쓰고, 완주 리포트를 받아요.' },
  { role: 'DIRECTOR', eyebrow: '유치원·학원·기관에서', title: '기관 및 단체', description: '반을 만들고 여러 아이가 함께 듣는 수업을 준비해요.' },
  { role: 'TUTOR', eyebrow: '수업에서', title: '선생님', description: '만나는 아이별로 수업을 준비하고 부모님께 리포트를 전달해요. 기관 소속·독립 활동 모두 가능해요.' },
];

const TUTOR_CONSENT_SHARED_ITEMS = ['선생님이 진행한 질문·장면·리포트'];
const TUTOR_CONSENT_HIDDEN_ITEMS = ['가정 구독·결제·다른 이야기', '음성 원본과 아이의 성향 평가'];

/**
 * 환영→역할선택→가입/로그인으로 이어지는 순차 온보딩 - q-story-userflow-demo-main의 리뷰
 * 프로토타입(q-story-flow-prototype.tsx)이 보여주던 흐름을 이식하되, 가치제안 캐러셀
 * (ValueOnboardingStep)의 위치는 다르다: 가입 전이 아니라 "방금 가입해 세션은 이미 생겼지만
 * 아직 홈으로 가지 않은" 순간에 한 번만 끼워 넣는다 - 이 계정이 존재하는 한 통틀어 딱 한 번,
 * 첫 가입 직후에만 보이고 이후 로그인(onSignedIn)에서는 절대 다시 나오지 않는다. 이 화면들은
 * 순수 클라이언트 UI 단계라 auth 상태로 유도할 수 없어서(OrganizationSignupPage와 달리), 로컬
 * step state + go(step)를 쓰는 작은 상태머신으로 뒀다 - 이 앱에 처음 등장하는 패턴이다.
 *
 * <p>선생님 초대(tutor-preview/tutor-consent)도 같은 상태머신 안에 산다 - 예전엔 별도 페이지
 * (ParentLinkAcceptPage)였는데, 기관 반코드 매칭은 이 흐름에 자연스럽게 녹아있는 반면 선생님
 * 매칭만 색이 다른 화면으로 튀어서 학부모가 겪는 경험이 둘 사이에 어긋났다. tutor-preview에서
 * 미리보기를 보여준 뒤 기존 sign-up/sign-in 스텝을 그대로 재사용하고(계정 정보만 모아두고 API는
 * 아직 안 부름), tutor-consent에서 공유 범위를 확인받은 다음에야 실제로 계정 생성+초대 수락을
 * 한 번에 부른다 - ParentLinkAcceptPage가 하던 순서(미리보기→계정→동의→수락) 그대로다.
 */
export function OnboardingFlow({
  initialStep = 'welcome',
  initialRole,
  initialInvite,
  initialTutorInvite,
  onExit,
}: OnboardingFlowProps) {
  const navigate = useNavigate();
  const { state: authState, setSession } = useAuth();
  const [step, setStep] = useState<OnboardingStep>(initialStep);
  // 초대 토큰이 있으면 role이 PARENT로 잠긴다(ClassService.resolveClassGroup의 XOR 요구,
  // 선생님 초대도 학부모만 받는 개념이라 마찬가지).
  const [role, setRole] = useState<OnboardingRole | null>(
    initialInvite || initialTutorInvite ? 'PARENT' : (initialRole ?? null),
  );
  // 방금 가입한 계정을 어디로 보낼지 - 캐러셀을 다 보거나 건너뛴 뒤에 이동한다.
  const [pendingHomePath, setPendingHomePath] = useState<string | null>(null);
  const go = useCallback((next: OnboardingStep) => setStep(next), []);

  // ---- 선생님 초대(tutor-preview/tutor-consent) 전용 상태 ----
  const [tutorPreviewLoading, setTutorPreviewLoading] = useState(Boolean(initialTutorInvite));
  const [tutorPreview, setTutorPreview] = useState<TutorInvitePreview | null>(null);
  const [tutorPreviewError, setTutorPreviewError] = useState<string | null>(null);
  // sign-up으로 왔는지 sign-in으로 왔는지 - tutor-consent에서 성공했을 때 신규 가입 취급(캐러셀
  // 경유)할지 로그인 취급(곧장 홈)할지, 그리고 "← 이전"이 어디로 돌아갈지 가른다.
  const [tutorAuthMode, setTutorAuthMode] = useState<'sign-up' | 'sign-in' | null>(null);
  const [pendingTutorAccept, setPendingTutorAccept] = useState<PendingTutorAccept | null>(null);
  const [tutorAcceptError, setTutorAcceptError] = useState<string | null>(null);
  const [tutorAccepting, setTutorAccepting] = useState(false);

  const goHome = useCallback(
    (path: string) => navigate(path, { replace: true }),
    [navigate],
  );

  // 로그인은 매번 곧장 홈으로 - 계정을 통틀어 처음 만들어질 때만 거치는 흐름이 아니다.
  const onSignedIn: OnAuthed = useCallback(
    (token, user) => {
      setSession(token, user);
      goHome(homePathFor(user));
    },
    [setSession, goHome],
  );

  // 방금 가입해 세션은 이미 생겼지만, 홈으로 보내기 전에 가치 제안 캐러셀을 한 번 보여준다 -
  // 이 계정이 존재하는 한 다시 로그인해도 나오지 않는, 통틀어 딱 한 번뿐인 순간이다.
  // 캐러셀이 끝나면 역할별 온보딩(부모 아이 등록, 선생님 소속 설정)으로 이어지고, 온보딩이
  // 끝나면 그때 각 역할의 실제 홈으로 진입한다.
  const onSignedUp: OnAuthed = useCallback(
    (token, user) => {
      setSession(token, user);
      const nextAfterCarousel = user.role === 'PARENT'
        ? '/onboarding/parent'
        : user.role === 'TUTOR'
          ? '/onboarding/tutor'
          : homePathFor(user);
      setPendingHomePath(nextAfterCarousel);
      go('value-onboarding');
    },
    [setSession, go],
  );

  useEffect(() => {
    if (!initialTutorInvite) return;
    let cancelled = false;
    const previewPromise = initialTutorInvite.isCode
      ? previewTutorInviteByCode(initialTutorInvite.value)
      : previewTutorInvite(initialTutorInvite.value);
    previewPromise
      .then((response) => {
        if (cancelled) return;
        setTutorPreview(response);
        setTutorPreviewLoading(false);
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        setTutorPreviewError(
          messageForError(
            failure,
            initialTutorInvite.isCode ? '초대 코드를 확인하지 못했어요.' : '초대 링크를 확인하지 못했어요.',
          ),
        );
        setTutorPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // initialTutorInvite는 HomePage가 URL에서 매번 새로 만들어 넘기므로 .value/.isCode로 좁힌다 -
    // 객체 identity로 의존하면 부모 리렌더마다 이 effect가 불필요하게 다시 돈다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTutorInvite?.value, initialTutorInvite?.isCode]);

  const onTutorAccept = useCallback(async () => {
    if (!initialTutorInvite || !pendingTutorAccept) return;
    setTutorAcceptError(null);
    setTutorAccepting(true);
    try {
      const body =
        pendingTutorAccept.kind === 'token'
          ? { token: pendingTutorAccept.token }
          : {
              loginId: pendingTutorAccept.loginId,
              email: pendingTutorAccept.email,
              password: pendingTutorAccept.password,
              displayName: pendingTutorAccept.displayName,
            };
      const response = initialTutorInvite.isCode
        ? await acceptTutorInviteByCode(initialTutorInvite.value, body)
        : await acceptTutorInvite(initialTutorInvite.value, body);
      // 마케팅 동의 값을 알림 설정에 즉시 반영 - 일반 학부모 가입과 같은 처리(실패해도 연결
      // 자체는 완료된 상태라 조용히 넘긴다).
      if (pendingTutorAccept.kind === 'new-account') {
        void updateNotificationSettings(response.token, { marketingEnabled: pendingTutorAccept.marketing }).catch(() => {});
      }
      if (tutorAuthMode === 'sign-in') {
        onSignedIn(response.token, response.user);
      } else {
        onSignedUp(response.token, response.user);
      }
    } catch (failure) {
      setTutorAcceptError(messageForError(failure, '연결을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setTutorAccepting(false);
    }
  }, [initialTutorInvite, pendingTutorAccept, tutorAuthMode, onSignedIn, onSignedUp]);

  return (
    <View style={styles.screen}>
      {step !== 'welcome' && step !== 'tutor-preview' ? (
        <Pressable
          accessibilityRole="link"
          hitSlop={8}
          style={styles.backLink}
          onPress={() => {
            if (step === 'value-onboarding') {
              if (pendingHomePath) goHome(pendingHomePath);
            } else if (step === 'role') go('welcome');
            else if (step === 'sign-up') go(initialTutorInvite ? 'tutor-preview' : 'role');
            else if (step === 'sign-in') go(initialTutorInvite ? 'tutor-preview' : 'welcome');
            else if (step === 'tutor-consent') {
              // 이미 로그인된 채로 들어와 preview에서 곧장 넘어온 경우엔 다시 채울 로그인
              // 폼이 없다 - preview로 돌아간다.
              if (authState.status === 'authenticated') go('tutor-preview');
              else go(tutorAuthMode === 'sign-in' ? 'sign-in' : 'sign-up');
            }
          }}
        >
          <Text style={styles.backLinkText}>← 이전</Text>
        </Pressable>
      ) : (
        <Pressable accessibilityRole="link" hitSlop={8} style={styles.backLink} onPress={onExit}>
          <Text style={styles.backLinkText}>← 서재로</Text>
        </Pressable>
      )}

      <View style={styles.body}>
        {step === 'welcome' && <WelcomeStep onSignUp={() => go('role')} onSignIn={() => go('sign-in')} />}
        {step === 'role' && (
          <RoleStep
            onSelect={(next) => {
              setRole(next);
              go('sign-up');
            }}
          />
        )}
        {step === 'sign-up' && role && (
          <SignUpStep
            role={role}
            inviteToken={initialInvite ?? null}
            tutorInvite={initialTutorInvite ?? null}
            tutorPreview={tutorPreview}
            onAuthed={onSignedUp}
            onCollectForTutorInvite={(fields) => {
              setTutorAuthMode('sign-up');
              setPendingTutorAccept({ kind: 'new-account', ...fields });
              go('tutor-consent');
            }}
          />
        )}
        {step === 'sign-in' && (
          <SignInStep
            onAuthed={onSignedIn}
            onGoSignUp={() => go(initialTutorInvite ? 'tutor-preview' : 'role')}
            onGoResetPassword={() => navigate('/reset-password')}
            tutorInvite={initialTutorInvite ?? null}
            onCollectTokenForTutorInvite={(token) => {
              setTutorAuthMode('sign-in');
              setPendingTutorAccept({ kind: 'token', token });
              go('tutor-consent');
            }}
          />
        )}
        {step === 'value-onboarding' && (
          <ValueOnboardingStep
            onDone={() => {
              if (pendingHomePath) goHome(pendingHomePath);
            }}
          />
        )}
        {step === 'tutor-preview' && initialTutorInvite && (
          <TutorPreviewStep
            loading={tutorPreviewLoading}
            preview={tutorPreview}
            error={tutorPreviewError}
            // 이미 로그인된 채로 이 초대를 열었다면(예: 마이페이지 > 수업 연결에서 링크를 붙여넣은
            // 경우) 계정을 또 만들거나 다시 로그인할 필요가 없다 - 지금 세션의 토큰을 그대로
            // 들고 동의 단계로 간다.
            alreadyAuthenticated={authState.status === 'authenticated'}
            onContinue={() => go('sign-up')}
            onSignIn={() => go('sign-in')}
            onContinueAuthenticated={() => {
              if (authState.status !== 'authenticated') return;
              setTutorAuthMode('sign-in');
              setPendingTutorAccept({ kind: 'token', token: authState.token });
              go('tutor-consent');
            }}
          />
        )}
        {step === 'tutor-consent' && (
          <TutorConsentStep
            submitting={tutorAccepting}
            error={tutorAcceptError}
            onAccept={onTutorAccept}
          />
        )}
      </View>
    </View>
  );
}

function WelcomeStep({ onSignUp, onSignIn }: { onSignUp: () => void; onSignIn: () => void }) {
  return (
    <View style={styles.welcome}>
      <BrandLockup />
      <Text style={styles.welcomeTitle}>오늘, 아이의 한마디가{'\n'}이야기를 움직여요.</Text>
      <Text style={styles.welcomeLead}>
        검수된 동화를 듣고 아이가 생각을 말하면,{'\n'}그 뜻이 짧은 장면 변화와 대화 기록으로 이어져요.
      </Text>
      <View style={styles.welcomeSteps}>
        {['동화 듣기', '생각 말하기', '달라진 장면'].map((label, index) => (
          <View key={label} style={styles.welcomeStep}>
            <Text style={styles.welcomeStepNumber}>{String(index + 1).padStart(2, '0')}</Text>
            <Text style={styles.welcomeStepLabel}>{label}</Text>
          </View>
        ))}
      </View>
      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeCardTitle}>Q-Story를 처음 사용하시나요?</Text>
        <Text style={styles.welcomeCardBody}>회원가입부터 나에게 맞는 홈, 첫 이야기까지 순서대로 시작해보세요.</Text>
        <ActionButton variant="gold" label="처음이에요 · 회원가입" onPress={onSignUp} />
        <ActionButton variant="secondaryFull" label="이미 계정이 있어요 · 로그인" onPress={onSignIn} />
      </View>
    </View>
  );
}

function ValueOnboardingStep({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const slide = VALUE_SLIDES[index];
  const isLast = index === VALUE_SLIDES.length - 1;
  return (
    <View style={styles.carousel}>
      <View style={styles.carouselTop}>
        <Pressable accessibilityRole="button" onPress={onDone}>
          <Text style={styles.backLinkText}>건너뛰기</Text>
        </Pressable>
      </View>
      <Text style={styles.eyebrow}>{slide.eyebrow}</Text>
      <Text style={styles.carouselTitle}>{slide.title}</Text>
      <Text style={styles.welcomeLead}>{slide.body}</Text>
      <View style={styles.dots}>
        {VALUE_SLIDES.map((item, dotIndex) => (
          <View key={item.eyebrow} style={[styles.dot, dotIndex === index && styles.dotActive]} />
        ))}
      </View>
      <ActionButton
        variant="gold"
        label={isLast ? '시작하기' : '다음'}
        onPress={() => (isLast ? onDone() : setIndex((value) => value + 1))}
      />
    </View>
  );
}

function RoleStep({ onSelect }: { onSelect: (role: OnboardingRole) => void }) {
  return (
    <View style={styles.roleStep}>
      <Text style={styles.eyebrow}>회원가입 · 1 / 2</Text>
      <Text style={styles.carouselTitle}>Q-Story를 주로 어디에서{'\n'}사용하실 예정인가요?</Text>
      <Text style={styles.welcomeLead}>선택한 역할에 맞춰 첫 화면과 안내를 준비해요.</Text>
      <View style={styles.roleGrid}>
        {ROLE_CARDS.map((card) => (
          <Pressable
            key={card.role}
            accessibilityRole="button"
            onPress={() => onSelect(card.role)}
            style={({ pressed }) => [styles.roleCard, pressed && styles.pressed]}
          >
            <Text style={styles.roleCardEyebrow}>{card.eyebrow}</Text>
            <Text style={styles.roleCardTitle}>{card.title}</Text>
            <Text style={styles.roleCardBody}>{card.description}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/**
 * 선생님 초대 링크/코드로 들어왔을 때 첫 화면 - 누가, 어떤 아이 앞으로 보낸 초대인지 계정을
 * 만들거나 로그인하기 전에 먼저 보여준다("내 아이가 맞나?" 확인). 예전 ParentLinkAcceptPage의
 * 'preview' 스테이지와 같은 역할.
 */
function TutorPreviewStep({
  loading,
  preview,
  error,
  alreadyAuthenticated,
  onContinue,
  onSignIn,
  onContinueAuthenticated,
}: {
  loading: boolean;
  preview: TutorInvitePreview | null;
  error: string | null;
  /** 이미 로그인된 세션으로 이 초대를 열었는지 - 마이페이지 > 수업 연결에서 링크를 붙여넣은
   *  경우가 대표적이다. true면 계정 만들기/로그인 선택 대신 "연결하기" 버튼 하나만 보인다. */
  alreadyAuthenticated: boolean;
  onContinue: () => void;
  onSignIn: () => void;
  onContinueAuthenticated: () => void;
}) {
  if (loading) {
    return (
      <View style={styles.tutorPreviewLoading}>
        <LoadingState label="초대를 확인하는 중이에요…" />
      </View>
    );
  }
  if (error || !preview) {
    return <ErrorState message={error ?? '초대 정보를 불러오지 못했어요.'} />;
  }
  return (
    <View style={styles.welcome}>
      <Text style={styles.eyebrow}>{preview.tutorDisplayName}이 보낸 안전한 초대 링크</Text>
      <Text style={styles.welcomeTitle}>{preview.studentName}의 오늘 이야기 기록이{'\n'}도착했어요</Text>
      <View style={styles.previewCard}>
        <Text style={styles.previewName}>{preview.studentName} · {preview.ageBand}</Text>
        <Text style={styles.previewNote}>{preview.tutorDisplayName}이 전달한 정보예요.</Text>
      </View>
      <View style={styles.welcomeCard}>
        {alreadyAuthenticated ? (
          <>
            <Text style={styles.welcomeCardTitle}>지금 로그인된 계정으로 연결할게요</Text>
            <ActionButton variant="gold" label="연결하기" onPress={onContinueAuthenticated} />
          </>
        ) : (
          <>
            <Text style={styles.welcomeCardTitle}>내 아이 기록이 맞다면 계속할게요</Text>
            <ActionButton variant="gold" label="처음이에요 · 계정 만들고 연결하기" onPress={onContinue} />
            <ActionButton variant="secondaryFull" label="이미 계정이 있어요 · 로그인하고 연결하기" onPress={onSignIn} />
          </>
        )}
      </View>
    </View>
  );
}

/** 예전 ParentLinkAcceptPage의 'consent' 스테이지 - 문구/항목은 그대로, 스타일만 이 온보딩
 * 흐름의 공유 톤(styles.title/welcomeCard 등)에 맞췄다. */
function TutorConsentStep({
  submitting,
  error,
  onAccept,
}: {
  submitting: boolean;
  error: string | null;
  onAccept: () => void;
}) {
  return (
    <View style={styles.welcome}>
      <Text style={styles.welcomeTitle}>부모님이 확인할 내용</Text>
      <View style={styles.consentCard}>
        <Text style={styles.consentGroupLabel}>부모가 받음</Text>
        {TUTOR_CONSENT_SHARED_ITEMS.map((item) => (
          <Text key={item} style={styles.consentItemAllowed}>· {item}</Text>
        ))}
        <Text style={styles.consentGroupLabel}>공유 안 됨</Text>
        {TUTOR_CONSENT_HIDDEN_ITEMS.map((item) => (
          <Text key={item} style={styles.consentItemBlocked}>· {item}</Text>
        ))}
      </View>
      <Text style={styles.formNote}>연결해도 선생님은 가정 구독 정보나 다른 이야기 기록을 볼 수 없어요.</Text>
      {error ? <StatusBanner variant="warning" label={error} /> : null}
      <ActionButton variant="gold" label={submitting ? '연결하는 중…' : '동의하고 연결 완료'} onPress={onAccept} loading={submitting} />
    </View>
  );
}

function SignUpStep({
  role,
  inviteToken,
  tutorInvite,
  tutorPreview,
  onAuthed,
  onCollectForTutorInvite,
}: {
  role: OnboardingRole;
  inviteToken: string | null;
  /** 있으면 이 스텝은 계정 생성 API를 직접 부르지 않는다 - 필드만 모아 onCollectForTutorInvite로
   *  올려보내고, 실제 계정 생성+초대 수락은 tutor-consent에서 한 번에 처리한다. */
  tutorInvite: TutorInviteRef | null;
  tutorPreview: TutorInvitePreview | null;
  onAuthed: OnAuthed;
  onCollectForTutorInvite: (fields: {
    loginId: string;
    email: string;
    password: string;
    displayName: string;
    marketing: boolean;
  }) => void;
}) {
  const [hasClass, setHasClass] = useState(true);
  const [classCode, setClassCode] = useState('');
  const [orgName, setOrgName] = useState('');
  const [loginId, setLoginId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [terms, setTerms] = useState<TermsConsentState>(EMPTY_TERMS_CONSENT);

  // 초대 토큰이 있으면 반코드 토글/입력은 감추고 초대 안내만 보인다 - ClassService의 XOR 규약
  // 상 classCode/inviteToken 중 정확히 하나만 실려 나가야 한다. 선생님 초대(tutorInvite)일 땐
  // 애초에 joinClass 자체를 안 부르니 반코드 UI가 필요 없다.
  const showClassCodeField = role === 'PARENT' && !inviteToken && !tutorInvite && hasClass;
  const showOrgNameField = role === 'DIRECTOR';
  const useJoinFlow = role === 'PARENT' && (Boolean(inviteToken) || hasClass);
  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const canSubmit =
    Boolean(loginId.trim()) &&
    Boolean(email.trim()) &&
    Boolean(password) &&
    password === confirmPassword &&
    Boolean(displayName.trim()) &&
    termsConsentIsValid(terms) &&
    (showClassCodeField ? classCode.trim().length > 0 : true) &&
    (showOrgNameField ? orgName.trim().length > 0 : true);

  const onSubmit = useCallback(async () => {
    if (password !== confirmPassword) {
      setError('비밀번호가 서로 달라요.');
      return;
    }
    setError(null);
    // 선생님 초대는 계정을 여기서 만들지 않는다 - tutor-consent에서 동의를 받은 뒤 초대 수락
    // API가 계정 생성까지 한 번에 처리한다(ParentLinkAcceptPage.onAccept와 같은 계약).
    if (tutorInvite) {
      onCollectForTutorInvite({
        loginId: loginId.trim(),
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        marketing: terms.marketing,
      });
      return;
    }
    setSubmitting(true);
    try {
      const input = { loginId: loginId.trim(), email: email.trim(), password, displayName: displayName.trim() };
      if (role === 'DIRECTOR') {
        // 계정 생성 직후 같은 화면에서 받은 기관명으로 바로 기관을 만들어, 예전처럼
        // "가입 -> /organization에서 기관명 다시 입력" 두 단계로 나뉘지 않게 한다.
        const signupResponse = await signupOrganizationOwner(input);
        const orgResponse = await createOrganization(signupResponse.token, {
          name: orgName.trim(),
        });
        onAuthed(orgResponse.token, orgResponse.user);
        return;
      }
      const response =
        role === 'TUTOR'
          ? await signupTutor(input)
          : useJoinFlow
            ? await joinClass({
                ...(inviteToken ? { inviteToken } : { classCode: classCode.trim().toUpperCase() }),
                ...input,
              })
            : await signupParent(input);
      // 마케팅 동의 값을 알림 설정에 즉시 반영 - 실패해도 회원가입 자체는 완료된 상태라 조용히
      // 넘긴다(사용자가 마이페이지 알림 설정에서 다시 조정할 수 있다).
      if (response.user.role === 'PARENT' || response.user.role === 'TUTOR') {
        void updateNotificationSettings(response.token, { marketingEnabled: terms.marketing }).catch(() => {});
      }
      onAuthed(response.token, response.user);
    } catch (failure) {
      const fallback =
        role === 'DIRECTOR'
          ? '기관 관리자 계정을 만들지 못했어요. 잠시 후 다시 시도해 주세요.'
          : role === 'TUTOR'
            ? '선생님 계정을 만들지 못했어요. 잠시 후 다시 시도해 주세요.'
            : useJoinFlow
              ? '반 코드로 가입하지 못했어요. 반 코드와 입력값을 확인해 주세요.'
              : '학부모 계정을 만들지 못했어요. 잠시 후 다시 시도해 주세요.';
      setError(messageForError(failure, fallback));
    } finally {
      setSubmitting(false);
    }
  }, [
    role,
    inviteToken,
    tutorInvite,
    onCollectForTutorInvite,
    useJoinFlow,
    classCode,
    orgName,
    loginId,
    email,
    password,
    confirmPassword,
    displayName,
    terms.marketing,
    onAuthed,
  ]);

  return (
    <View style={styles.form}>
      <Text style={styles.eyebrow}>회원가입 · 2 / 2</Text>
      <Text style={styles.carouselTitle}>계정을 만들어볼까요?</Text>
      <Text style={styles.welcomeLead}>
        {role === 'PARENT' ? '학부모' : role === 'DIRECTOR' ? '기관 및 단체' : '선생님'} 홈을 준비할게요.
      </Text>

      {tutorInvite && (
        <Text style={styles.formNote}>
          {tutorPreview?.tutorDisplayName ? `${tutorPreview.tutorDisplayName} 선생님의 초대로 연결돼요.` : '선생님의 초대로 연결돼요.'}
        </Text>
      )}

      {role === 'PARENT' && !tutorInvite && (
        inviteToken ? (
          <Text style={styles.formNote}>초대 링크로 반이 확인됐어요.</Text>
        ) : (
          <>
            <Checkbox checked={hasClass} onChange={setHasClass} label="우리 아이 반이 있어요" />
            {hasClass ? (
              <TextField
                label="반 코드"
                value={classCode}
                onChangeText={setClassCode}
                autoCapitalize="characters"
                placeholder="선생님께 받은 코드"
              />
            ) : (
              <Text style={styles.formNote}>반 코드 없이 학부모 계정만 만들어요.</Text>
            )}
          </>
        )
      )}

      {role === 'DIRECTOR' && (
        <TextField
          label="기관 및 단체 이름"
          value={orgName}
          onChangeText={setOrgName}
          placeholder="예: 무지개 유치원"
        />
      )}

      <TextField label="아이디" value={loginId} onChangeText={setLoginId} placeholder="로그인에 쓸 아이디" />
      <TextField label="이메일" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <TextField label="비밀번호" value={password} onChangeText={setPassword} secureTextEntry />
      <TextField
        label="비밀번호 확인"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        errorText={passwordMismatch ? '비밀번호가 서로 달라요.' : undefined}
      />
      <TextField label="이름" value={displayName} onChangeText={setDisplayName} />
      <TermsConsent
        value={terms}
        onChange={setTerms}
        onOpenDoc={(kind) => {
          if (typeof window !== 'undefined') {
            window.alert?.(
              kind === 'marketing'
                ? '마케팅 정보 수신 동의 문서는 곧 공개돼요.'
                : '이용약관/개인정보 처리방침 문서는 곧 공개돼요.',
            );
          }
        }}
      />
      {error ? <StatusBanner variant="warning" label={error} /> : null}
      <ActionButton
        variant="gold"
        label={submitting ? '가입 중…' : tutorInvite ? '다음' : '가입하기'}
        onPress={onSubmit}
        disabled={submitting || !canSubmit}
      />
      {!tutorInvite && <SocialLoginButtons role={role} onAuthed={onAuthed} />}
    </View>
  );
}

function SignInStep({
  onAuthed,
  onGoSignUp,
  onGoResetPassword,
  tutorInvite,
  onCollectTokenForTutorInvite,
}: {
  onAuthed: OnAuthed;
  onGoSignUp: () => void;
  onGoResetPassword: () => void;
  /** 있으면 로그인 성공 뒤 곧장 onAuthed(홈 이동)로 가지 않고, 얻은 토큰을 tutor-consent로 넘긴다. */
  tutorInvite: TutorInviteRef | null;
  onCollectTokenForTutorInvite: (token: string) => void;
}) {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      const response = await login({ loginId: loginId.trim(), password });
      if (tutorInvite) {
        onCollectTokenForTutorInvite(response.token);
        return;
      }
      onAuthed(response.token, response.user);
    } catch (failure) {
      setError(messageForError(failure, '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setSubmitting(false);
    }
  }, [loginId, password, tutorInvite, onCollectTokenForTutorInvite, onAuthed]);

  return (
    <View style={styles.form}>
      <Text style={styles.carouselTitle}>로그인</Text>
      {tutorInvite ? <Text style={styles.formNote}>로그인하면 바로 이 초대를 연결할게요.</Text> : null}
      <TextField
        label="아이디"
        value={loginId}
        onChangeText={setLoginId}
        placeholder="아이디"
      />
      <TextField
        label="비밀번호"
        value={password}
        onChangeText={setPassword}
        placeholder="비밀번호"
        secureTextEntry
        errorText={error ?? undefined}
      />
      <Pressable accessibilityRole="link" hitSlop={4} onPress={onGoResetPassword} style={styles.signInInlineLink}>
        <Text style={styles.signInInlineLinkText}>비밀번호를 잊으셨나요?</Text>
      </Pressable>
      <ActionButton
        variant="gold"
        label={submitting ? '로그인 중…' : '로그인'}
        onPress={onSubmit}
        disabled={submitting || !loginId.trim() || !password}
      />
      {!tutorInvite && <SocialLoginButtons onAuthed={onAuthed} />}
      <Pressable accessibilityRole="link" hitSlop={4} onPress={onGoSignUp} style={styles.signInSignUpRow}>
        <Text style={styles.formNote}>아직 계정이 없으신가요? </Text>
        <Text style={styles.signInInlineLinkText}>회원가입</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: '100%',
    backgroundColor: storybookTheme.color.background,
    paddingTop: 12,
  },
  backLink: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  backLinkText: {
    color: storybookTheme.color.onContentMuted,
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.semibold,
  },
  body: {
    flex: 1,
    width: '100%',
    maxWidth: storybookTheme.layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  pressed: { opacity: 0.9 },
  eyebrow: {
    color: storybookTheme.color.gold,
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.semibold,
    letterSpacing: 0.4,
    marginTop: 8,
  },

  // Welcome
  welcome: { gap: 14, alignItems: 'center', paddingTop: 8 },
  welcomeTitle: {
    color: storybookTheme.color.onContent,
    fontSize: storybookTheme.type.xl,
    lineHeight: 34,
    fontWeight: storybookTheme.type.weight.bold,
    textAlign: 'center',
    marginTop: 8,
  },
  welcomeLead: {
    color: storybookTheme.color.onContentMuted,
    fontSize: storybookTheme.type.sm,
    lineHeight: 21,
    fontWeight: storybookTheme.type.weight.light,
    textAlign: 'center',
  },
  welcomeSteps: { flexDirection: 'row', gap: 20, marginTop: 6 },
  welcomeStep: { alignItems: 'center', gap: 2 },
  welcomeStepNumber: { color: storybookTheme.color.gold, fontSize: storybookTheme.type.xs, fontWeight: storybookTheme.type.weight.bold },
  welcomeStepLabel: { color: storybookTheme.color.onContentMuted, fontSize: storybookTheme.type.xs, fontWeight: storybookTheme.type.weight.medium },
  welcomeCard: {
    width: '100%',
    gap: 10,
    marginTop: 16,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderRadius: storybookTheme.radius.card,
    padding: 20,
  },
  welcomeCardTitle: {
    color: storybookTheme.color.onCardTitle,
    fontSize: storybookTheme.type.md,
    lineHeight: storybookTheme.type.md * storybookTheme.lineHeight.normal,
    fontWeight: storybookTheme.type.weight.bold,
    textAlign: 'center',
  },
  welcomeCardBody: { color: storybookTheme.color.onCardBody, fontSize: storybookTheme.type.sm, lineHeight: 20, textAlign: 'center', marginBottom: 4 },

  // 선생님 초대 미리보기/동의 - ParentLinkAcceptPage에서 옮겨온 카드 스타일.
  tutorPreviewLoading: { paddingTop: 40 },
  previewCard: {
    width: '100%',
    gap: 4,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderRadius: storybookTheme.radius.card,
    padding: 16,
  },
  previewName: { fontSize: storybookTheme.type.md, fontWeight: storybookTheme.type.weight.bold, color: storybookTheme.color.onCardTitle },
  previewNote: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onCardMuted },
  consentCard: {
    width: '100%',
    gap: 4,
    backgroundColor: storybookTheme.color.contentPanel,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentPanelBorder,
    borderRadius: storybookTheme.radius.card,
    padding: 16,
  },
  consentGroupLabel: { fontSize: storybookTheme.type.xxs, fontWeight: storybookTheme.type.weight.bold, color: storybookTheme.color.gold, marginTop: 8, letterSpacing: 0.4 },
  consentItemAllowed: { fontSize: storybookTheme.type.sm, lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal, color: storybookTheme.color.onContent },
  consentItemBlocked: { fontSize: storybookTheme.type.sm, lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal, color: storybookTheme.color.onContentMuted },

  // Carousel / role / form shared title
  carouselTop: { alignItems: 'flex-end', marginBottom: 4 },
  carouselTitle: {
    color: storybookTheme.color.onContent,
    fontSize: storybookTheme.type.lg,
    lineHeight: storybookTheme.type.lg * storybookTheme.lineHeight.tight,
    letterSpacing: storybookTheme.type.lg * storybookTheme.tracking.heading,
    fontWeight: storybookTheme.type.weight.bold,
    marginTop: 4,
  },
  dots: { flexDirection: 'row', gap: 6, marginTop: 20, marginBottom: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: storybookTheme.color.contentPanelBorder },
  dotActive: { backgroundColor: storybookTheme.color.gold, width: 18 },
  carousel: { gap: 10, paddingTop: 8 },

  // Role
  roleStep: { gap: 10, paddingTop: 8 },
  roleGrid: { gap: 12, marginTop: 12 },
  roleCard: {
    backgroundColor: storybookTheme.color.contentPanel,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentPanelBorder,
    borderRadius: storybookTheme.radius.card,
    padding: 18,
    gap: 4,
  },
  roleCardEyebrow: { color: storybookTheme.color.gold, fontSize: storybookTheme.type.xs, fontWeight: storybookTheme.type.weight.semibold },
  roleCardTitle: {
    color: storybookTheme.color.onContent,
    fontSize: storybookTheme.type.md,
    lineHeight: storybookTheme.type.md * storybookTheme.lineHeight.normal,
    fontWeight: storybookTheme.type.weight.bold,
  },
  roleCardBody: { color: storybookTheme.color.onContentMuted, fontSize: storybookTheme.type.sm, lineHeight: 20, fontWeight: storybookTheme.type.weight.light },

  // Forms (sign-up / sign-in)
  form: { gap: 14, paddingTop: 8 },
  formNote: { color: storybookTheme.color.onContentMuted, fontSize: storybookTheme.type.sm },
  signInInlineLink: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' },
  signInInlineLinkText: {
    color: storybookTheme.color.linkOnDark,
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
  },
  signInSignUpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 44,
    alignItems: 'center',
    marginTop: 8,
  },
});
