import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, BrandLockup, Checkbox, StatusBanner, TextField, storybookTheme } from '@/shared/ui';
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
  EMPTY_TERMS_CONSENT,
  TermsConsent,
  termsConsentIsValid,
  type TermsConsentState,
} from '@/features/terms-consent';
import { SocialLoginButtons } from '@/features/oauth-login';

type OnAuthed = (token: string, user: UserSummary) => void;

type OnboardingRole = 'PARENT' | 'DIRECTOR' | 'TUTOR';
type OnboardingStep = 'welcome' | 'value-onboarding' | 'role' | 'sign-up' | 'sign-in';

type OnboardingFlowProps = {
  /** HomePage의 원장님/학부모님 역할 카드나 "로그인" 링크에서 곧장 들어올 때 해당 단계로 시작한다. */
  initialStep?: OnboardingStep;
  initialRole?: OnboardingRole;
  /** 이메일 초대 링크나 /tutor-invite/... 리다이렉트로 들어올 때 - PARENT role로 잠기고 반코드
   *  입력 대신 초대 토큰으로 joinClass를 부른다. */
  initialInvite?: string;
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
  { role: 'TUTOR', eyebrow: '가정 방문·1:1 수업에서', title: '방문 선생님', description: '만나는 아이별로 수업을 준비하고 부모님께 리포트를 전달해요.' },
];

/**
 * 환영→역할선택→가입/로그인으로 이어지는 순차 온보딩 - q-story-userflow-demo-main의 리뷰
 * 프로토타입(q-story-flow-prototype.tsx)이 보여주던 흐름을 이식하되, 가치제안 캐러셀
 * (ValueOnboardingStep)의 위치는 다르다: 가입 전이 아니라 "방금 가입해 세션은 이미 생겼지만
 * 아직 홈으로 가지 않은" 순간에 한 번만 끼워 넣는다 - 이 계정이 존재하는 한 통틀어 딱 한 번,
 * 첫 가입 직후에만 보이고 이후 로그인(onSignedIn)에서는 절대 다시 나오지 않는다. 이 화면들은
 * 순수 클라이언트 UI 단계라 auth 상태로 유도할 수 없어서(OrganizationSignupPage와 달리), 로컬
 * step state + go(step)를 쓰는 작은 상태머신으로 뒀다 - 이 앱에 처음 등장하는 패턴이다.
 */
export function OnboardingFlow({ initialStep = 'welcome', initialRole, initialInvite, onExit }: OnboardingFlowProps) {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [step, setStep] = useState<OnboardingStep>(initialStep);
  // 초대 토큰으로 들어오면 role이 PARENT로 잠긴다(ClassService.resolveClassGroup의 XOR 요구).
  const [role, setRole] = useState<OnboardingRole | null>(initialInvite ? 'PARENT' : (initialRole ?? null));
  // 방금 가입한 계정을 어디로 보낼지 - 캐러셀을 다 보거나 건너뛴 뒤에 이동한다.
  const [pendingHomePath, setPendingHomePath] = useState<string | null>(null);
  const go = useCallback((next: OnboardingStep) => setStep(next), []);

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

  return (
    <View style={styles.screen}>
      {step !== 'welcome' ? (
        <Pressable
          accessibilityRole="link"
          hitSlop={8}
          style={styles.backLink}
          onPress={() => {
            if (step === 'value-onboarding') {
              if (pendingHomePath) goHome(pendingHomePath);
            } else if (step === 'role') go('welcome');
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
          <SignUpStep role={role} inviteToken={initialInvite ?? null} onAuthed={onSignedUp} />
        )}
        {step === 'sign-in' && (
          <SignInStep
            onAuthed={onSignedIn}
            onGoSignUp={() => go('role')}
            onGoResetPassword={() => navigate('/reset-password')}
          />
        )}
        {step === 'value-onboarding' && (
          <ValueOnboardingStep
            onDone={() => {
              if (pendingHomePath) goHome(pendingHomePath);
            }}
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

function SignUpStep({
  role,
  inviteToken,
  onAuthed,
}: {
  role: OnboardingRole;
  inviteToken: string | null;
  onAuthed: OnAuthed;
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
  // 상 classCode/inviteToken 중 정확히 하나만 실려 나가야 한다.
  const showClassCodeField = role === 'PARENT' && !inviteToken && hasClass;
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
  }, [role, inviteToken, useJoinFlow, classCode, orgName, loginId, email, password, confirmPassword, displayName, terms.marketing, onAuthed]);

  return (
    <View style={styles.form}>
      <Text style={styles.eyebrow}>회원가입 · 2 / 2</Text>
      <Text style={styles.carouselTitle}>계정을 만들어볼까요?</Text>
      <Text style={styles.welcomeLead}>
        {role === 'PARENT' ? '학부모' : role === 'DIRECTOR' ? '기관 및 단체' : '방문 선생님'} 홈을 준비할게요.
      </Text>

      {role === 'PARENT' && (
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
      <ActionButton variant="gold" label={submitting ? '가입 중…' : '가입하기'} onPress={onSubmit} disabled={submitting || !canSubmit} />
      <SocialLoginButtons role={role} onAuthed={onAuthed} />
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
  onGoResetPassword: () => void;
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
      onAuthed(response.token, response.user);
    } catch (failure) {
      setError(messageForError(failure, '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setSubmitting(false);
    }
  }, [loginId, password, onAuthed]);

  return (
    <View style={styles.form}>
      <Text style={styles.carouselTitle}>로그인</Text>
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
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.sm,
    fontWeight: '600',
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
    fontWeight: '600',
    letterSpacing: 0.4,
    marginTop: 8,
  },

  // Welcome
  welcome: { gap: 14, alignItems: 'center', paddingTop: 8 },
  welcomeTitle: {
    color: storybookTheme.color.onDark,
    fontSize: storybookTheme.type.xl,
    lineHeight: 34,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  welcomeLead: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.sm,
    lineHeight: 21,
    fontWeight: '300',
    textAlign: 'center',
  },
  welcomeSteps: { flexDirection: 'row', gap: 20, marginTop: 6 },
  welcomeStep: { alignItems: 'center', gap: 2 },
  welcomeStepNumber: { color: storybookTheme.color.gold, fontSize: storybookTheme.type.xs, fontWeight: '700' },
  welcomeStepLabel: { color: storybookTheme.color.onDarkMuted, fontSize: storybookTheme.type.xs, fontWeight: '500' },
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
    fontWeight: '700',
    textAlign: 'center',
  },
  welcomeCardBody: { color: storybookTheme.color.onCardBody, fontSize: storybookTheme.type.sm, lineHeight: 20, textAlign: 'center', marginBottom: 4 },

  // Carousel / role / form shared title
  carouselTop: { alignItems: 'flex-end', marginBottom: 4 },
  carouselTitle: {
    color: storybookTheme.color.onDark,
    fontSize: storybookTheme.type.lg,
    lineHeight: storybookTheme.type.lg * storybookTheme.lineHeight.tight,
    letterSpacing: storybookTheme.type.lg * storybookTheme.tracking.heading,
    fontWeight: '700',
    marginTop: 4,
  },
  dots: { flexDirection: 'row', gap: 6, marginTop: 20, marginBottom: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: storybookTheme.color.panelOnDarkBorder },
  dotActive: { backgroundColor: storybookTheme.color.gold, width: 18 },
  carousel: { gap: 10, paddingTop: 8 },

  // Role
  roleStep: { gap: 10, paddingTop: 8 },
  roleGrid: { gap: 12, marginTop: 12 },
  roleCard: {
    backgroundColor: storybookTheme.color.panelOnDarkBackground,
    borderWidth: 1,
    borderColor: storybookTheme.color.panelOnDarkBorder,
    borderRadius: storybookTheme.radius.card,
    padding: 18,
    gap: 4,
  },
  roleCardEyebrow: { color: storybookTheme.color.gold, fontSize: storybookTheme.type.xs, fontWeight: '600' },
  roleCardTitle: {
    color: storybookTheme.color.onDark,
    fontSize: storybookTheme.type.md,
    lineHeight: storybookTheme.type.md * storybookTheme.lineHeight.normal,
    fontWeight: '700',
  },
  roleCardBody: { color: storybookTheme.color.onDarkMuted, fontSize: storybookTheme.type.sm, lineHeight: 20, fontWeight: '300' },

  // Forms (sign-up / sign-in)
  form: { gap: 14, paddingTop: 8 },
  formNote: { color: storybookTheme.color.onDarkMuted, fontSize: storybookTheme.type.sm },
  signInInlineLink: { alignSelf: 'flex-end', minHeight: 32, justifyContent: 'center' },
  signInInlineLinkText: {
    color: storybookTheme.color.linkOnDark,
    fontSize: storybookTheme.type.xs,
    fontWeight: '700',
  },
  signInSignUpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 32,
    alignItems: 'center',
    marginTop: 8,
  },
});
