import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, BrandLockup, Checkbox, ErrorState, LoadingState, StatusBanner, TextField, storybookTheme } from '@/shared/ui';
import { ageBandFromLabel } from '@/entities/child';
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
  | 'tutor-consent'
  | 'tutor-linked';

/** 가입 폼의 최소 규칙 - reset-password의 "8자 이상"과 같은 기준을 가입에서도 쓴다(예전엔 가입은
 *  아무 비밀번호나 받고 재설정만 8자를 요구해 서로 어긋났다). */
export const PASSWORD_MIN_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  // 미리보기 재조회 트리거 - 만료/오타 코드로 ErrorState가 떴을 때 "다시 시도"가 이걸 올린다.
  const [tutorPreviewAttempt, setTutorPreviewAttempt] = useState(0);

  // 선생님 초대로 만든 새 학부모 계정은 /onboarding/parent의 아이 프로필 폼에 초대가 이미 알고
  // 있는 아이 이름/연령대를 미리 채워 준다 - 방금 미리보기에서 본 정보를 또 타이핑하게 하지 않도록.
  const goHome = useCallback(
    (path: string, state?: unknown) => navigate(path, { replace: true, state }),
    [navigate],
  );
  const parentOnboardingState = tutorPreview
    ? { prefill: { name: tutorPreview.studentName, ageBand: ageBandFromLabel(tutorPreview.ageBand) } }
    : undefined;

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
  }, [initialTutorInvite?.value, initialTutorInvite?.isCode, tutorPreviewAttempt]);

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
      // 곧장 홈/캐러셀로 보내지 않고 "연결됐어요" 확인 화면(tutor-linked)을 한 번 거친다 - 예전엔
      // 동의 버튼을 누르자마자 마케팅 캐러셀이나 부모 홈으로 튕겨서, 연결이 실제로 됐는지 부모가
      // 확인할 순간이 없었다. 세션은 여기서 바로 만들고, 다음 목적지만 pendingHomePath에 둔다.
      setSession(response.token, response.user);
      setPendingHomePath(
        tutorAuthMode === 'sign-in'
          ? homePathFor(response.user)
          : response.user.role === 'PARENT'
            ? '/onboarding/parent'
            : homePathFor(response.user),
      );
      go('tutor-linked');
    } catch (failure) {
      setTutorAcceptError(messageForError(failure, '연결을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setTutorAccepting(false);
    }
  }, [initialTutorInvite, pendingTutorAccept, tutorAuthMode, setSession, go]);

  // 캐러셀(value-onboarding)엔 자체 "건너뛰기"가 있고, 연결 완료(tutor-linked)는 되돌아갈 이전
  // 단계가 없다(이미 계정이 만들어지고 연결까지 끝난 뒤) - 두 화면에선 상단 링크를 아예 숨긴다.
  // 예전엔 캐러셀의 "← 이전"이 실제로는 홈으로 *앞서* 가는 버튼이었다.
  const hideTopLink = step === 'value-onboarding' || step === 'tutor-linked';

  return (
    <View style={styles.screen}>
      {hideTopLink ? (
        <View style={styles.backLink} />
      ) : step !== 'welcome' && step !== 'tutor-preview' ? (
        <Pressable
          accessibilityRole="link"
          hitSlop={8}
          style={styles.backLink}
          onPress={() => {
            if (step === 'role') go('welcome');
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

      {/* ScrollView - 가입 폼(입력 5개 + 약관 카드 + 소셜 버튼)은 폰 세로 화면보다 길어서, 평범한
          View였을 땐 아래쪽 버튼이 화면 밖으로 잘린 채 닿지 않았다. keyboardShouldPersistTaps로
          입력 중 버튼 탭이 키보드 닫기에 먹히지 않게 한다. */}
      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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
            onGoResetPassword={(loginId) => navigate('/reset-password', { state: { loginId } })}
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
              if (pendingHomePath) {
                goHome(pendingHomePath, pendingHomePath === '/onboarding/parent' ? parentOnboardingState : undefined);
              }
            }}
          />
        )}
        {step === 'tutor-preview' && initialTutorInvite && (
          <TutorPreviewStep
            // 세션 복원이 끝나기 전엔 "로그인됐는지"를 모른다 - 그동안 계정 만들기/로그인 버튼을
            // 보여줬다가 한 박자 뒤 "연결하기" 하나로 바뀌면 깜빡임처럼 보여서, 로딩으로 묶는다.
            loading={tutorPreviewLoading || authState.status === 'loading'}
            preview={tutorPreview}
            error={tutorPreviewError}
            // 로딩/에러 상태는 이벤트 핸들러에서 되돌리고, effect는 attempt 변화에 따라
            // 다시 조회만 한다(effect 본문의 setState는 lint가 막는다).
            onRetry={() => {
              setTutorPreviewLoading(true);
              setTutorPreviewError(null);
              setTutorPreviewAttempt((n) => n + 1);
            }}
            onExit={onExit}
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
            preview={tutorPreview}
            submitting={tutorAccepting}
            error={tutorAcceptError}
            onAccept={onTutorAccept}
          />
        )}
        {step === 'tutor-linked' && (
          <TutorLinkedStep
            preview={tutorPreview}
            newAccount={tutorAuthMode !== 'sign-in'}
            onDone={() => {
              if (!pendingHomePath) return;
              // 새 계정은 가치 소개 캐러셀을 한 번 거친 뒤 아이 프로필 온보딩으로, 기존 계정은
              // 곧장 홈으로 - onSignedUp/onSignedIn이 하던 구분 그대로.
              if (tutorAuthMode === 'sign-in') goHome(pendingHomePath);
              else go('value-onboarding');
            }}
          />
        )}
      </ScrollView>
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
  onRetry,
  onExit,
  alreadyAuthenticated,
  onContinue,
  onSignIn,
  onContinueAuthenticated,
}: {
  loading: boolean;
  preview: TutorInvitePreview | null;
  error: string | null;
  onRetry: () => void;
  onExit: () => void;
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
    // 예전엔 메시지만 있고 버튼이 없어서, 만료됐거나 잘못 적힌 코드로 들어온 부모는 여기서
    // 막다른 길이었다 - 재시도와 나가는 길을 둘 다 준다.
    return (
      <View style={styles.welcome}>
        <ErrorState message={error ?? '초대 정보를 불러오지 못했어요.'} onRetry={onRetry} />
        <Text style={styles.formNote}>
          초대가 만료됐거나 코드가 다를 수 있어요. 선생님께 새 초대를 요청해 주세요.
        </Text>
        <ActionButton variant="secondaryFull" label="서재로 돌아가기" onPress={onExit} />
      </View>
    );
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
  preview,
  submitting,
  error,
  onAccept,
}: {
  preview: TutorInvitePreview | null;
  submitting: boolean;
  error: string | null;
  onAccept: () => void;
}) {
  // 부모 온보딩(OnboardingParentPage)의 동의 화면과 같은 방식 - 버튼 하나로 "동의"를 갈음하지
  // 않고 확인 체크를 한 번 받는다. 이 동의는 아이 기록을 제3자(선생님)와 잇는 결정이라서.
  const [confirmed, setConfirmed] = useState(false);
  return (
    <View style={styles.welcome}>
      <Text style={styles.eyebrow}>연결 전 마지막 확인</Text>
      <Text style={styles.welcomeTitle}>
        {preview ? `${preview.tutorDisplayName} 선생님과\n${preview.studentName}의 기록을 나눠요` : '부모님이 확인할 내용'}
      </Text>
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
      <Text style={styles.formNote}>연결해도 선생님은 가정 구독 정보나 다른 이야기 기록을 볼 수 없어요. 연결은 마이페이지에서 언제든 끊을 수 있어요.</Text>
      <View style={styles.consentCheckRow}>
        <Checkbox checked={confirmed} onChange={setConfirmed} label="위 내용을 확인했고, 연결에 동의해요" />
      </View>
      {error ? <StatusBanner variant="warning" label={error} /> : null}
      <ActionButton
        variant="gold"
        label={submitting ? '연결하는 중…' : '동의하고 연결 완료'}
        onPress={onAccept}
        loading={submitting}
        disabled={!confirmed || submitting}
      />
    </View>
  );
}

/**
 * 연결이 실제로 끝난 뒤의 확인 화면 - 누구와, 어떤 아이가 이어졌는지와 앞으로 무엇이 오는지를
 * 한 번 보여준다. 새 계정이면 다음에 아이 프로필(이미 채워진 상태)로, 기존 계정이면 홈으로.
 */
function TutorLinkedStep({
  preview,
  newAccount,
  onDone,
}: {
  preview: TutorInvitePreview | null;
  newAccount: boolean;
  onDone: () => void;
}) {
  return (
    <View style={styles.welcome}>
      <View style={styles.linkedBadge}>
        <Text style={styles.linkedBadgeMark}>✓</Text>
      </View>
      <Text style={styles.welcomeTitle}>
        {preview ? `${preview.tutorDisplayName} 선생님과\n연결됐어요` : '선생님과 연결됐어요'}
      </Text>
      <Text style={styles.welcomeLead}>
        {preview
          ? `${preview.studentName}의 수업 리포트가 도착하면 알려드릴게요.\n선생님이 진행한 질문과 달라진 장면을 그대로 볼 수 있어요.`
          : '선생님이 진행한 수업 리포트가 도착하면 알려드릴게요.'}
      </Text>
      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeCardTitle}>
          {newAccount ? '이제 아이 프로필만 확인하면 끝이에요' : '홈에서 리포트를 기다려 주세요'}
        </Text>
        <Text style={styles.welcomeCardBody}>
          {newAccount
            ? '초대에 있던 아이 이름과 연령대를 미리 채워 뒀어요. 확인만 하면 돼요.'
            : '연결된 선생님과 아이는 마이페이지 > 수업 연결에서 볼 수 있어요.'}
        </Text>
        <ActionButton variant="gold" label={newAccount ? '다음' : '홈으로 가기'} onPress={onDone} />
      </View>
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
  // 입력을 시작한 뒤에만 인라인으로 지적한다 - 빈 필드에 처음부터 빨간 글씨를 띄우진 않는다.
  const emailInvalid = email.trim().length > 0 && !EMAIL_PATTERN.test(email.trim());
  const passwordTooShort = password.length > 0 && password.length < PASSWORD_MIN_LENGTH;

  const canSubmit =
    Boolean(loginId.trim()) &&
    Boolean(email.trim()) &&
    !emailInvalid &&
    password.length >= PASSWORD_MIN_LENGTH &&
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

      {/* autoComplete는 react-native-web이 DOM autocomplete로 그대로 넘긴다 - 브라우저/비밀번호
          관리자가 새 비밀번호 제안과 자동 저장을 제대로 하려면 이 힌트가 있어야 한다. */}
      <TextField
        label="아이디"
        value={loginId}
        onChangeText={setLoginId}
        placeholder="로그인에 쓸 아이디"
        autoComplete="username"
      />
      <TextField
        label="이메일"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoComplete="email"
        placeholder="example@email.com"
        errorText={emailInvalid ? '이메일 형식을 확인해 주세요.' : undefined}
      />
      <TextField
        label="비밀번호"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        description={`${PASSWORD_MIN_LENGTH}자 이상`}
        errorText={passwordTooShort ? `${PASSWORD_MIN_LENGTH}자 이상 입력해 주세요.` : undefined}
      />
      <TextField
        label="비밀번호 확인"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        autoComplete="new-password"
        errorText={passwordMismatch ? '비밀번호가 서로 달라요.' : undefined}
      />
      <TextField label="이름" value={displayName} onChangeText={setDisplayName} autoComplete="name" placeholder="아이에게 보일 부모님 이름" />
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
  /** 입력 중이던 아이디를 넘겨 재설정 화면에서 다시 타이핑하지 않게 한다. */
  onGoResetPassword: (loginId: string) => void;
  /** 있으면 로그인 성공 뒤 곧장 onAuthed(홈 이동)로 가지 않고, 얻은 토큰을 tutor-consent로 넘긴다. */
  tutorInvite: TutorInviteRef | null;
  onCollectTokenForTutorInvite: (token: string) => void;
}) {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = !submitting && Boolean(loginId.trim()) && Boolean(password);

  const onSubmit = useCallback(async () => {
    if (!loginId.trim() || !password) return;
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
      <Text style={styles.welcomeLead}>
        {tutorInvite ? '로그인하면 바로 이 초대를 연결할게요.' : '가입할 때 만든 아이디와 비밀번호로 들어와요.'}
      </Text>
      <TextField
        label="아이디"
        value={loginId}
        onChangeText={setLoginId}
        placeholder="아이디"
        autoComplete="username"
        returnKeyType="next"
      />
      <TextField
        label="비밀번호"
        value={password}
        onChangeText={setPassword}
        placeholder="비밀번호"
        secureTextEntry
        autoComplete="current-password"
        returnKeyType="go"
        onSubmitEditing={() => { if (canSubmit) void onSubmit(); }}
      />
      <Pressable accessibilityRole="link" hitSlop={4} onPress={() => onGoResetPassword(loginId.trim())} style={styles.signInInlineLink}>
        <Text style={styles.signInInlineLinkText}>비밀번호를 잊으셨나요?</Text>
      </Pressable>
      {/* 가입 폼과 같은 배너 - 예전엔 로그인 실패 메시지가 비밀번호 필드의 errorText로만 떠서
          "비밀번호가 틀렸다"처럼 읽혔다(실제론 아이디가 없거나 서버 오류일 수도 있다). */}
      {error ? <StatusBanner variant="warning" label={error} /> : null}
      <ActionButton
        variant="gold"
        label={submitting ? '로그인 중…' : '로그인'}
        onPress={onSubmit}
        disabled={!canSubmit}
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
  bodyScroll: { flex: 1, width: '100%' },
  body: {
    flexGrow: 1,
    width: '100%',
    maxWidth: storybookTheme.layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  consentCheckRow: { width: '100%', marginTop: 4 },
  linkedBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: storybookTheme.semantic.positive.background,
    borderWidth: 2,
    borderColor: storybookTheme.semantic.positive.border,
    marginTop: 12,
  },
  linkedBadgeMark: {
    color: storybookTheme.semantic.positive.text,
    fontSize: storybookTheme.type.xl,
    fontWeight: storybookTheme.type.weight.black,
    lineHeight: storybookTheme.type.xl,
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
