import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { afterSignUpPath } from '../model/after-sign-up';

import { ActionButton, BrandLockup, Checkbox, StatusBanner, TextField, storybookTheme } from '@/shared/ui';
import {
  createOrganization,
  homePathFor,
  isPasswordLongEnough,
  previewClassByCode,
  login,
  PASSWORD_RULE_HINT,
  PASSWORD_TOO_SHORT_MESSAGE,
  signupOrganizationOwner,
  signupParent,
  signupTutor,
  useAuth,
  type UserSummary,
} from '@/entities/auth';
import { messageForError } from '@/shared/api';
import { updateNotificationSettings } from '@/entities/notification-settings';
import {
  EMPTY_TERMS_CONSENT,
  TermsConsent,
  termsConsentIsValid,
  type TermsConsentState,
} from '@/features/terms-consent';
import { SocialLoginButtons } from '@/features/oauth-login';

/** next: 가입 직후 온보딩을 마친 뒤 이어서 갈 앱 내부 경로(반 코드로 가입하면 그 반의 연결 화면). */
type OnAuthed = (token: string, user: UserSummary, next?: string) => void;

type OnboardingRole = 'PARENT' | 'DIRECTOR' | 'TUTOR';
type OnboardingStep =
  | 'welcome'
  | 'value-onboarding'
  | 'role'
  | 'sign-up'
  | 'sign-in';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type OnboardingFlowProps = {
  /** HomePage의 원장님/학부모님 역할 카드나 "로그인" 링크에서 곧장 들어올 때 해당 단계로 시작한다. */
  initialStep?: OnboardingStep;
  initialRole?: OnboardingRole;
  /** 반 초대 링크에서 가입하러 왔을 때 학부모 가입 폼에 미리 채울 반 코드. */
  initialClassCode?: string;
  /** 로그인 뒤 역할 홈 대신 돌아갈 앱 내부 경로(반 초대 링크 등). */
  signInNext?: string;
  /** 가입 뒤 돌아갈 앱 내부 경로(기관 초대 수락 등). */
  signUpNext?: string;
  /** "← 처음으로"로 닫을 때 - HomePage가 평소 화면으로 되돌아간다. */
  onExit: () => void;
  /** 이 흐름 안에서 세션이 만들어졌을 때(가입 직후). HomePage가 이걸 보고 역할 홈
   *  리다이렉트를 보류한다 - 아니면 캐러셀·아이 등록 단계 전에 홈으로 튕긴다. */
  onSessionCreated?: () => void;
  /** 가입 전에 같은 내용의 튜토리얼(/tutorial)을 이미 봤으면 true - 가입 직후 가치 제안 캐러셀을
   *  한 번 더 보여 주지 않고 곧장 역할별 온보딩으로 보낸다. */
  skipValueCarousel?: boolean;
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

const DISPLAY_NAME_PLACEHOLDER: Record<OnboardingRole, string> = {
  PARENT: '아이에게 보일 보호자 이름',
  TUTOR: '아이와 부모님께 보일 이름 (예: 김하늘)',
  DIRECTOR: '담당자 이름',
};

const ROLE_CARDS: Array<{ role: OnboardingRole; eyebrow: string; title: string; description: string }> = [
  { role: 'PARENT', eyebrow: '가정에서', title: '보호자', description: '아이와 함께 이야기 서재를 쓰고, 리포트를 받아요.' },
  { role: 'DIRECTOR', eyebrow: '유치원·학원·기관에서', title: '기관', description: '반을 만들고 여러 아이가 함께 듣는 수업을 준비해요.' },
  { role: 'TUTOR', eyebrow: '수업에서', title: '선생님', description: '반을 만들어 수업을 준비하고 부모님께 리포트를 전달해요. 1:1 과외도 아이 한 명짜리 반으로 시작해요. 기관 소속·독립 활동 모두 가능해요.' },
];

/**
 * 환영→역할선택→가입/로그인 순차 온보딩(로컬 step 상태머신). 가치제안 캐러셀은 첫 가입 직후
 * 홈으로 가기 전에만 한 번 보인다.
 *
 * <p>선생님과의 연결은 언제나 반 초대 링크(/join?code=)로 이뤄진다 - 학생별 선생님 초대 단계는 두지 않는다.
 */
export function OnboardingFlow({
  initialStep = 'welcome',
  initialRole,
  initialClassCode,
  signInNext,
  signUpNext,
  onExit,
  onSessionCreated,
  skipValueCarousel = false,
}: OnboardingFlowProps) {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [step, setStep] = useState<OnboardingStep>(initialStep);
  const [role, setRole] = useState<OnboardingRole | null>(initialRole ?? null);
  // 방금 가입한 계정을 어디로 보낼지 - 캐러셀을 다 보거나 건너뛴 뒤에 이동한다.
  const [pendingHomePath, setPendingHomePath] = useState<string | null>(null);
  // 부모 온보딩(아이 프로필)을 마친 뒤 이어서 갈 곳 - 반 코드로 가입했으면 그 반에 아이를 고르는 화면.
  const [pendingNext, setPendingNext] = useState<string | null>(null);
  const go = setStep;

  const goHome = useCallback(
    (path: string, state?: unknown) => navigate(path, { replace: true, state }),
    [navigate],
  );
  // /onboarding/parent에 넘기는 상태 - 아이 프로필을 만든 뒤 이어서 갈 곳(반 코드로 가입했으면 반 연결 화면)만 싣는다.
  const parentOnboardingState = pendingNext ? { next: pendingNext } : {};

  // 로그인은 매번 곧장 홈으로 - 계정을 통틀어 처음 만들어질 때만 거치는 흐름이 아니다.
  const onSignedIn: OnAuthed = useCallback(
    (token, user) => {
      setSession(token, user);
      goHome(signInNext ?? homePathFor(user));
    },
    [setSession, goHome, signInNext],
  );

  // 가입 직후 홈으로 보내기 전에 가치 제안 캐러셀을 한 번 보여주고, 이어서 역할별 온보딩
  // (부모 아이 등록, 선생님 소속 설정)으로 보낸다.
  const onSignedUp: OnAuthed = useCallback(
    (token, user, next) => {
      onSessionCreated?.();
      setSession(token, user);
      setPendingNext(next ?? null);
      const nextAfterCarousel = afterSignUpPath(user.role as OnboardingRole, signUpNext);
      if (skipValueCarousel) {
        goHome(nextAfterCarousel, nextAfterCarousel === '/onboarding/parent' && next ? { next } : undefined);
        return;
      }
      setPendingHomePath(nextAfterCarousel);
      go('value-onboarding');
    },
    [setSession, go, goHome, onSessionCreated, skipValueCarousel, signUpNext],
  );

  // 캐러셀엔 자체 "건너뛰기"가 있어 상단 링크를 숨긴다.
  const hideTopLink = step === 'value-onboarding';

  return (
    <View style={styles.screen}>
      {hideTopLink ? (
        <View style={styles.backLink} />
      ) : step !== 'welcome' ? (
        <Pressable
          accessibilityRole="link"
          hitSlop={8}
          style={styles.backLink}
          onPress={() => {
            if (step === 'role') go('welcome');
            else if (step === 'sign-up') go('role');
            else if (step === 'sign-in') go('welcome');
          }}
        >
          <Text style={styles.backLinkText}>← 이전</Text>
        </Pressable>
      ) : (
        <Pressable accessibilityRole="link" hitSlop={8} style={styles.backLink} onPress={onExit}>
          <Text style={styles.backLinkText}>← 서재로</Text>
        </Pressable>
      )}

      {/* 가입 폼은 폰 세로 화면보다 길어 스크롤한다. keyboardShouldPersistTaps로 입력 중 버튼 탭이
          키보드 닫기에 먹히지 않게 한다. */}
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
            initialClassCode={initialClassCode}
            onAuthed={onSignedUp}
          />
        )}
        {step === 'sign-in' && (
          <SignInStep
            onAuthed={onSignedIn}
            onGoSignUp={() => go('role')}
            onGoResetPassword={(loginId) => navigate('/reset-password', { state: { loginId } })}
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
      </ScrollView>
    </View>
  );
}

function WelcomeStep({ onSignUp, onSignIn }: { onSignUp: () => void; onSignIn: () => void }) {
  return (
    <View style={styles.welcome}>
      <BrandLockup tone="onLight" />
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

function SignUpStep({
  role,
  initialClassCode,
  onAuthed,
}: {
  role: OnboardingRole;
  initialClassCode?: string;
  onAuthed: OnAuthed;
}) {
  const [hasClass, setHasClass] = useState(true);
  const [classCode, setClassCode] = useState(initialClassCode ?? '');
  const [orgName, setOrgName] = useState('');
  const [loginId, setLoginId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [terms, setTerms] = useState<TermsConsentState>(EMPTY_TERMS_CONSENT);

  // 반 코드로 가입하면 계정만 먼저 만들고, 아이 프로필을 만든 뒤 반 연결 화면(/join?code=)에서 그 아이를 고른다 -
  // 아이 이름·출생연도를 여기서 따로 적지 않는다.
  const useJoinFlow = role === 'PARENT' && hasClass;
  const showOrgNameField = role === 'DIRECTOR';
  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  // 입력을 시작한 뒤에만 인라인으로 지적한다 - 빈 필드에 처음부터 빨간 글씨를 띄우진 않는다.
  const emailInvalid = email.trim().length > 0 && !EMAIL_PATTERN.test(email.trim());
  const passwordTooShort = password.length > 0 && !isPasswordLongEnough(password);

  const canSubmit =
    Boolean(loginId.trim()) &&
    Boolean(email.trim()) &&
    !emailInvalid &&
    isPasswordLongEnough(password) &&
    password === confirmPassword &&
    Boolean(displayName.trim()) &&
    termsConsentIsValid(terms) &&
    (useJoinFlow ? classCode.trim().length > 0 : true) &&
    (showOrgNameField ? orgName.trim().length > 0 : true);

  const onSubmit = useCallback(async () => {
    if (password !== confirmPassword) {
      setError('비밀번호가 서로 달라요.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const input = { loginId: loginId.trim(), email: email.trim(), password, displayName: displayName.trim() };
      if (role === 'DIRECTOR') {
        // 계정 생성 직후 같은 화면에서 받은 기관명으로 바로 기관을 만든다.
        const signupResponse = await signupOrganizationOwner(input);
        const orgResponse = await createOrganization(signupResponse.token, {
          name: orgName.trim(),
        });
        onAuthed(orgResponse.token, orgResponse.user);
        return;
      }
      // 반 코드가 틀렸으면 계정을 만들기 전에 알린다.
      const joinCode = useJoinFlow ? classCode.trim().toUpperCase() : null;
      if (joinCode) await previewClassByCode(joinCode);
      const response = role === 'TUTOR' ? await signupTutor(input) : await signupParent(input);
      // 마케팅 동의 값을 알림 설정에 즉시 반영 - 실패해도 회원가입 자체는 완료된 상태라 조용히
      // 넘긴다(사용자가 마이페이지 알림 설정에서 다시 조정할 수 있다).
      if (response.user.role === 'PARENT' || response.user.role === 'TUTOR') {
        void updateNotificationSettings(response.token, { marketingEnabled: terms.marketing }).catch(() => {});
      }
      onAuthed(response.token, response.user, joinCode ? `/join?code=${encodeURIComponent(joinCode)}` : undefined);
    } catch (failure) {
      const fallback =
        role === 'DIRECTOR'
          ? '관리자 계정을 만들지 못했어요. 잠시 후 다시 시도해 주세요.'
          : role === 'TUTOR'
            ? '선생님 계정을 만들지 못했어요. 잠시 후 다시 시도해 주세요.'
            : useJoinFlow
              ? '가입하지 못했어요. 반 코드와 입력값을 확인해 주세요.'
              : '보호자 계정을 만들지 못했어요. 잠시 후 다시 시도해 주세요.';
      setError(messageForError(failure, fallback));
    } finally {
      setSubmitting(false);
    }
  }, [
    role,
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
      <Text style={[styles.welcomeLead, styles.formLead]}>
        {role === 'PARENT' ? '보호자' : role === 'DIRECTOR' ? '기관' : '선생님'} 홈을 준비할게요.
      </Text>

      {role === 'PARENT' && (
        <>
          <Checkbox checked={hasClass} onChange={setHasClass} label="우리 아이 반이 있어요" />
          {hasClass ? (
            <>
              <TextField
                label="반 코드"
                value={classCode}
                onChangeText={setClassCode}
                autoCapitalize="characters"
                placeholder="선생님께 받은 코드"
              />
              <Text style={styles.formNote}>가입하고 아이 프로필을 만들면 이 반에 연결할 아이를 고를 수 있어요.</Text>
            </>
          ) : (
            <Text style={styles.formNote}>반 코드 없이 보호자 계정만 만들어요.</Text>
          )}
        </>
      )}

      {role === 'DIRECTOR' && (
        <TextField
          label="기관 이름"
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
        description={PASSWORD_RULE_HINT}
        errorText={passwordTooShort ? PASSWORD_TOO_SHORT_MESSAGE : undefined}
      />
      <TextField
        label="비밀번호 확인"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        autoComplete="new-password"
        errorText={passwordMismatch ? '비밀번호가 서로 달라요.' : undefined}
      />
      <TextField label="이름" value={displayName} onChangeText={setDisplayName} autoComplete="name" placeholder={DISPLAY_NAME_PLACEHOLDER[role]} />
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
        label={submitting ? '가입 중…' : '가입하기'}
        onPress={onSubmit}
        disabled={submitting || !canSubmit}
      />
      {/* 소셜 가입은 반 코드를 싣지 못해 아이가 반에 연결되지 않는다 - 그 경로에서는 숨긴다. */}
      {!initialClassCode && <SocialLoginButtons role={role} onAuthed={onAuthed} />}
    </View>
  );
}

function SignInStep({
  onAuthed,
  onGoSignUp,
  onGoResetPassword,
}: {
  onAuthed: OnAuthed;
  onGoSignUp: () => void;
  /** 입력 중이던 아이디를 넘겨 재설정 화면에서 다시 타이핑하지 않게 한다. */
  onGoResetPassword: (loginId: string) => void;
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
      onAuthed(response.token, response.user);
    } catch (failure) {
      setError(messageForError(failure, '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setSubmitting(false);
    }
  }, [loginId, password, onAuthed]);

  return (
    <View style={styles.form}>
      <View style={styles.formBrand}>
        <BrandLockup tone="onLight" size="compact" />
      </View>
      <Text style={styles.carouselTitle}>로그인</Text>
      <Text style={[styles.welcomeLead, styles.formLead]}>
        가입할 때 만든 아이디와 비밀번호로 들어와요.
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
      {/* 필드 errorText가 아니라 배너 - 실패 원인이 비밀번호만은 아니라서. */}
      {error ? <StatusBanner variant="warning" label={error} /> : null}
      <ActionButton
        variant="gold"
        label={submitting ? '로그인 중…' : '로그인'}
        onPress={onSubmit}
        disabled={!canSubmit}
      />
      <SocialLoginButtons onAuthed={onAuthed} />
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
  pressed: { opacity: 0.9 },
  eyebrow: {
    color: storybookTheme.color.primary,
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
  welcomeStepNumber: { color: storybookTheme.color.primary, fontSize: storybookTheme.type.xs, fontWeight: storybookTheme.type.weight.bold },
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
  dotActive: { backgroundColor: storybookTheme.color.primary, width: 18 },
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
  roleCardEyebrow: { color: storybookTheme.color.primary, fontSize: storybookTheme.type.xs, fontWeight: storybookTheme.type.weight.semibold },
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
  formBrand: { alignItems: 'center', marginBottom: storybookTheme.spacing.xs },
  // 폼 제목(왼쪽 정렬)에 맞춰 lead도 왼쪽 정렬.
  formLead: { textAlign: 'left' },
  signInInlineLinkText: {
    color: storybookTheme.color.linkOnLight,
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    textDecorationLine: 'underline',
  },
  signInSignUpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 44,
    alignItems: 'center',
    marginTop: 8,
  },
});
