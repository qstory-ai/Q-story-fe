import { useCallback, useEffect, useState } from 'react';
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
  toConsentPayload,
  useAuth,
  type UserSummary,
} from '@/entities/auth';
import { messageForError } from '@/shared/api';
import { betaErrorCode, recordingConsentStore, trackBetaEvent } from '@/entities/analytics';
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
type OnboardingStep = 'role' | 'sign-up' | 'sign-in';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type OnboardingFlowProps = {
  /** HomePage의 역할 카드나 "로그인" 버튼에서 곧장 들어올 때 해당 단계로 시작한다(기본: 역할 선택). */
  initialStep?: OnboardingStep;
  initialRole?: OnboardingRole;
  /** 반 초대 링크에서 가입하러 왔을 때 보호자 가입 폼에 미리 채울 반 코드. */
  initialClassCode?: string;
  /** 로그인 뒤 역할 홈 대신 돌아갈 앱 내부 경로(반 초대 링크 등). */
  signInNext?: string;
  /** 가입 뒤 돌아갈 앱 내부 경로(기관 초대 수락 등). */
  signUpNext?: string;
  /** "← 처음으로"로 닫을 때 - HomePage가 평소 화면으로 되돌아간다. */
  onExit: () => void;
  /** 이 흐름 안에서 세션이 만들어졌을 때(가입 직후). HomePage가 이걸 보고 역할 홈
   *  리다이렉트를 보류한다 - 아니면 역할별 온보딩(아이 등록 등)으로 가기 전에 홈으로 튕긴다. */
  onSessionCreated?: () => void;
};

const DISPLAY_NAME_PLACEHOLDER: Record<OnboardingRole, string> = {
  PARENT: '아이에게 보일 보호자 이름',
  TUTOR: '아이와 보호자께 보일 이름 (예: 김하늘)',
  DIRECTOR: '담당자 이름',
};

const ROLE_CARDS: Array<{ role: OnboardingRole; title: string; description: string }> = [
  { role: 'PARENT', title: '보호자', description: '아이와 함께 이야기 서재를 쓰고, 리포트를 받아요.' },
  { role: 'DIRECTOR', title: '기관', description: '유치원·학원에서 반을 만들고 여러 아이가 함께 듣는 수업을 준비해요.' },
  { role: 'TUTOR', title: '선생님', description: '반을 만들어 수업을 준비하고 보호자께 리포트를 전달해요. 1:1 과외도 아이 한 명짜리 반으로 시작해요. 기관 소속·독립 활동 모두 가능해요.' },
];

/**
 * 역할선택→가입 / 로그인 온보딩(로컬 step 상태머신). 서비스 소개는 첫 방문 튜토리얼(/tutorial) 한 곳에서만
 * 한다 - 예전의 환영 화면과 가입 직후 가치 제안 캐러셀은 같은 소개를 반복해 없앴다(Q-36).
 *
 * <p>선생님과의 연결은 언제나 반 초대 링크(/join?code=)로 이뤄진다 - 학생별 선생님 초대 단계는 두지 않는다.
 */
export function OnboardingFlow({
  initialStep = 'role',
  initialRole,
  initialClassCode,
  signInNext,
  signUpNext,
  onExit,
  onSessionCreated,
}: OnboardingFlowProps) {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [step, setStep] = useState<OnboardingStep>(initialStep);
  const [role, setRole] = useState<OnboardingRole | null>(initialRole ?? null);
  const go = setStep;

  const goHome = useCallback(
    (path: string, state?: unknown) => navigate(path, { replace: true, state }),
    [navigate],
  );

  // 로그인은 매번 곧장 홈으로 - 계정을 통틀어 처음 만들어질 때만 거치는 흐름이 아니다.
  const onSignedIn: OnAuthed = useCallback(
    (token, user) => {
      setSession(token, user);
      goHome(signInNext ?? homePathFor(user));
    },
    [setSession, goHome, signInNext],
  );

  // 가입 직후 곧장 역할별 온보딩(보호자 아이 등록, 선생님 소속 설정)으로 보낸다. 보호자의 next(반 코드로
  // 가입했으면 반 연결 화면)는 아이 등록 뒤에 쓰도록 /onboarding/parent에 상태로 넘긴다.
  const onSignedUp: OnAuthed = useCallback(
    (token, user, next) => {
      onSessionCreated?.();
      setSession(token, user);
      const path = afterSignUpPath(user.role as OnboardingRole, signUpNext);
      goHome(path, path === '/onboarding/parent' && next ? { next } : undefined);
    },
    [setSession, goHome, onSessionCreated, signUpNext],
  );

  return (
    <View style={styles.screen}>
      {step === 'sign-up' ? (
        <Pressable accessibilityRole="link" hitSlop={8} style={styles.backLink} onPress={() => go('role')}>
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
        {step === 'role' && (
          <RoleStep
            onSelect={(next) => {
              setRole(next);
              go('sign-up');
            }}
            onGoSignIn={() => go('sign-in')}
          />
        )}
        {step === 'sign-up' && role && (
          <SignUpStep
            role={role}
            initialClassCode={initialClassCode}
            showStepCount={initialStep !== 'sign-up'}
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
      </ScrollView>
    </View>
  );
}

function RoleStep({ onSelect, onGoSignIn }: { onSelect: (role: OnboardingRole) => void; onGoSignIn: () => void }) {
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
            <Text style={styles.roleCardTitle}>{card.title}</Text>
            <Text style={styles.roleCardBody}>{card.description}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable accessibilityRole="link" hitSlop={4} onPress={onGoSignIn} style={styles.signInSignUpRow}>
        <Text style={styles.formNote}>이미 계정이 있으신가요? </Text>
        <Text style={styles.signInInlineLinkText}>로그인</Text>
      </Pressable>
    </View>
  );
}

function SignUpStep({
  role,
  initialClassCode,
  showStepCount,
  onAuthed,
}: {
  role: OnboardingRole;
  initialClassCode?: string;
  /** 역할 선택 단계를 거쳐 왔을 때만 "2 / 2"를 보인다. */
  showStepCount?: boolean;
  onAuthed: OnAuthed;
}) {
  // 반 코드는 반 초대 링크로 들어왔을 때만 기본으로 켠다 - 대부분의 보호자는 반 없이 가입해, 기본으로 켜
  // 두면 끄는 클릭이 한 번 더 든다(Q-36).
  const [hasClass, setHasClass] = useState(Boolean(initialClassCode));
  const [classCode, setClassCode] = useState(initialClassCode ?? '');
  const [orgName, setOrgName] = useState('');
  const [loginId, setLoginId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [terms, setTerms] = useState<TermsConsentState>(EMPTY_TERMS_CONSENT);
  // 보호자 가입의 선택 항목 - 가입 뒤 계정의 화면 녹화 결정으로 남긴다(체크 안 함도 결정).
  const [allowRecording, setAllowRecording] = useState(false);

  // 가입 폼을 연 것과 끝낸 것(Q-40 UT) - 가입·연결에서 막히는 지점을 본다.
  const signupEntry = initialClassCode ? 'class_link' : 'direct';
  useEffect(() => {
    void trackBetaEvent('signup_started', { role, entry: signupEntry });
  }, [role, signupEntry]);
  const trackSignupCompleted = useCallback(
    (method: 'password' | 'google' | 'kakao', hasClassCode: boolean) => {
      void trackBetaEvent('signup_completed', { role, method, has_class_code: hasClassCode });
    },
    [role],
  );

  // 반 코드로 가입하면 계정만 먼저 만들고, 아이 프로필을 만든 뒤 반 연결 화면(/join?code=)에서 그 아이를 고른다 -
  // 아이 이름·출생연도를 여기서 따로 적지 않는다.
  const useJoinFlow = role === 'PARENT' && hasClass;
  const showOrgNameField = role === 'DIRECTOR';
  // 입력을 시작한 뒤에만 인라인으로 지적한다 - 빈 필드에 처음부터 빨간 글씨를 띄우진 않는다.
  const emailInvalid = email.trim().length > 0 && !EMAIL_PATTERN.test(email.trim());
  const passwordTooShort = password.length > 0 && !isPasswordLongEnough(password);

  const canSubmit =
    Boolean(loginId.trim()) &&
    Boolean(email.trim()) &&
    !emailInvalid &&
    isPasswordLongEnough(password) &&
    Boolean(displayName.trim()) &&
    termsConsentIsValid(terms) &&
    (useJoinFlow ? classCode.trim().length > 0 : true) &&
    (showOrgNameField ? orgName.trim().length > 0 : true);

  const onSubmit = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      const input = {
        loginId: loginId.trim(),
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        consents: toConsentPayload(terms),
      };
      if (role === 'DIRECTOR') {
        // 계정 생성 직후 같은 화면에서 받은 기관명으로 바로 기관을 만든다.
        const signupResponse = await signupOrganizationOwner(input);
        const orgResponse = await createOrganization(signupResponse.token, {
          name: orgName.trim(),
        });
        trackSignupCompleted('password', false);
        onAuthed(orgResponse.token, orgResponse.user);
        return;
      }
      // 반 코드가 틀렸으면 계정을 만들기 전에 알린다.
      const joinCode = useJoinFlow ? classCode.trim().toUpperCase() : null;
      if (joinCode) {
        const via = initialClassCode ? 'invite_link' : 'code_input';
        void trackBetaEvent('class_join', { step: 'attempt', via });
        try {
          await previewClassByCode(joinCode);
        } catch (failure) {
          void trackBetaEvent('class_join', {
            step: 'error',
            via,
            error_code: betaErrorCode(failure),
          });
          throw failure;
        }
      }
      const response = role === 'TUTOR' ? await signupTutor(input) : await signupParent(input);
      trackSignupCompleted('password', Boolean(joinCode));
      // 화면 녹화 허용(선택) - 체크하지 않았어도 "허용 안 함"으로 남겨 이야기 시작 화면에서 다시 묻지 않는다.
      // 세션을 넘기기 전에 남긴다 - 로그인 직후 계정 설정을 불러올 때 이 결정이 보이게. 실패해도 가입은 그대로.
      if (role === 'PARENT') await recordingConsentStore().recordSignupDecision(response.token, allowRecording);
      // 마케팅 동의는 가입 요청의 consents로 서버가 가입 트랜잭션에서 저장한다.
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
    initialClassCode,
    trackSignupCompleted,
    orgName,
    loginId,
    email,
    password,
    displayName,
    terms,
    allowRecording,
    onAuthed,
  ]);

  return (
    <View style={styles.form}>
      <Text style={styles.eyebrow}>{showStepCount ? '회원가입 · 2 / 2' : '회원가입'}</Text>
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
        secureTextEntry={!showPassword}
        autoComplete="new-password"
        description={PASSWORD_RULE_HINT}
        errorText={passwordTooShort ? PASSWORD_TOO_SHORT_MESSAGE : undefined}
      />
      <Checkbox checked={showPassword} onChange={setShowPassword} label="비밀번호 보기" />
      <TextField label="이름" value={displayName} onChangeText={setDisplayName} autoComplete="name" placeholder={DISPLAY_NAME_PLACEHOLDER[role]} />
      <TermsConsent
        value={terms}
        onChange={setTerms}
        recording={role === 'PARENT' ? { checked: allowRecording, onChange: setAllowRecording } : undefined}
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
      {!initialClassCode && (
        <SocialLoginButtons
          role={role}
          onAuthed={(token, user, provider) => {
            // 이미 있는 소셜 계정이면 로그인이지만, 가입 화면에서 누른 것이라 가입 완료로 센다(대부분 새 계정).
            if (provider) trackSignupCompleted(provider, false);
            onAuthed(token, user);
          }}
          consents={termsConsentIsValid(terms) ? toConsentPayload(terms) : undefined}
          disabled={!termsConsentIsValid(terms)}
          disabledHint="약관에 동의하면 소셜 계정으로 가입할 수 있어요."
        />
      )}
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
  // 끄면 짧은 토큰을 sessionStorage에 둔다 - 탭(네이티브 앱은 앱 프로세스)이 닫히면 로그아웃된다(entities/auth session.ts).
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = !submitting && Boolean(loginId.trim()) && Boolean(password);

  const onSubmit = useCallback(async () => {
    if (!loginId.trim() || !password) return;
    setError(null);
    setSubmitting(true);
    try {
      const response = await login({ loginId: loginId.trim(), password, rememberMe });
      onAuthed(response.token, response.user);
    } catch (failure) {
      setError(messageForError(failure, '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setSubmitting(false);
    }
  }, [loginId, password, rememberMe, onAuthed]);

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
      <Checkbox
        checked={rememberMe}
        onChange={setRememberMe}
        label="로그인 유지"
        description="공용 기기에서는 체크를 해제해 주세요."
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
      <SocialLoginButtons onAuthed={onAuthed} rememberMe={rememberMe} />
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

  welcomeLead: {
    color: storybookTheme.color.onContentMuted,
    fontSize: storybookTheme.type.sm,
    lineHeight: 21,
    fontWeight: storybookTheme.type.weight.light,
    textAlign: 'center',
  },

  // role / form shared title
  carouselTitle: {
    color: storybookTheme.color.onContent,
    fontSize: storybookTheme.type.lg,
    lineHeight: storybookTheme.type.lg * storybookTheme.lineHeight.tight,
    letterSpacing: storybookTheme.type.lg * storybookTheme.tracking.heading,
    fontWeight: storybookTheme.type.weight.bold,
    marginTop: 4,
  },

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
