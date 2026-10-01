import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import { ActionButton, BrandLockup, SafeAreaView, storybookTheme } from '@/shared/ui';
import { homePathFor, useAuth } from '@/entities/auth';
import { StoryLibraryGrid } from '@/features/story-library';
import { OnboardingFlow } from '@/features/onboarding';
import { hasSeenTutorial } from '@/pages/tutorial';
import { readOnboardingParams, type OnboardingEntry } from '../model/onboarding-params';

// IA의 회원 유형 분류에 맞춘 표기 - 기관 소속 여부와 무관하게 모두 "선생님"으로 표기하고,
// 실제 소속은 온보딩 이후에 결정된다.
const ROLE_OPTIONS: { role: 'DIRECTOR' | 'PARENT' | 'TUTOR'; label: string; body: string }[] = [
  { role: 'PARENT', label: '보호자', body: '아이와 함께 이야기 서재를 시작해요' },
  { role: 'TUTOR', label: '선생님', body: '반을 만들고 수업을 준비해요' },
  // OnboardingFlow의 ROLE_CARDS와 같은 표기("기관")를 유지한다.
  { role: 'DIRECTOR', label: '기관', body: '유치원·기관을 등록하고 반을 만들어요' },
];

/**
 * "/"의 서재 홈. <StoryLibraryGrid />가 책장이고, 언락 여부는 entities/story의 unlockStateFor()가
 * 판단한다.
 *
 * 비로그인 패널의 역할 카드는 <OnboardingFlow/>의 해당 단계로 곧장 진입시킨다 - 역할이 정해진
 * 카드는 role-select를 건너뛰고 바로 sign-up 단계로.
 *
 * 로그인된 사용자는 역할 홈으로 즉시 리다이렉트한다. homePathFor()가 "/"를 반환하는(알 수 없는
 * role) 경우에만 리다이렉트 루프를 막기 위해 이 화면을 그대로 보여준다.
 */
export function HomePage() {
  const { state, logout } = useAuth();
  const navigate = useNavigate();
  const { width } = useWindowDimensions();
  const isWide = width >= 720;
  const [searchParams] = useSearchParams();
  // /login, /signup, /join 은 이 페이지로 리다이렉트되며 ?flow=... 파라미터로 온보딩 흐름의
  // 특정 스텝을 지정한다. searchParams가 있으면 상태보다 파라미터를 우선한다 - URL이 진실.
  const paramEntry = useMemo(() => readOnboardingParams(searchParams), [searchParams]);
  const [manualOnboarding, setManualOnboarding] = useState<OnboardingEntry | null>(null);
  const onboarding = paramEntry ?? manualOnboarding;
  // OnboardingFlow가 이 화면 안에서 세션을 만들었다(가입 직후). 그 순간 아래
  // "로그인됐으면 역할 홈으로" 리다이렉트가 끼어들면 캐러셀·아이 등록 단계를 못 보고 홈으로 튕긴다 -
  // 흐름이 스스로 navigate(replace)로 떠날 때까지 리다이렉트를 보류한다.
  const [flowOwnsSession, setFlowOwnsSession] = useState(false);

  if (state.status === 'authenticated' && !flowOwnsSession) {
    const homePath = homePathFor(state.user);
    if (homePath !== '/') {
      return <Navigate to={homePath} replace />;
    }
  }

  // 아직 로그인 전인 첫 방문자는 튜토리얼로 우회 - localStorage 마크를 두어 이후에는 뜨지 않음.
  // 로그인/가입 딥링크로 들어온 경우(paramEntry)엔 튜토리얼을 건너뛴다 - 이미 뭘 할지 알고
  // 왔다는 뜻이므로 중간에 튜토리얼을 끼우면 방해가 된다.
  if (state.status === 'anonymous' && !hasSeenTutorial() && !paramEntry) {
    return <Navigate to="/tutorial" replace />;
  }

  if (onboarding) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
        <OnboardingFlow
          initialStep={onboarding.step}
          initialRole={onboarding.role}
          initialClassCode={onboarding.classCode}
          signInNext={onboarding.step === 'sign-in' ? onboarding.next : undefined}
          signUpNext={onboarding.step === 'sign-in' ? undefined : onboarding.next}
          skipValueCarousel={hasSeenTutorial()}
          // URL 파라미터로 들어온 경우엔 state를 비워도 paramEntry가 계속 이기므로 파라미터 없는
          // "/"로 실제로 이동한다.
          onExit={() => {
            setManualOnboarding(null);
            setFlowOwnsSession(false);
            if (paramEntry) navigate('/', { replace: true });
          }}
          onSessionCreated={() => setFlowOwnsSession(true)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <View style={styles.scroll}>
        <View style={styles.header}>
          <BrandLockup />
          <Text style={styles.tagline}>아이가 이야기 속 궁금증을 질문으로 표현하고, 얻은 답을 다음 선택에 써봐요</Text>
        </View>

        <StoryLibraryGrid />

        {/* Nothing below the grid until auth resolves - an account panel that flips to a sign-in
            panel a moment later reads as a glitch. */}
        {state.status === 'anonymous' && (
          <View style={[styles.panel, isWide && styles.panelWide]}>
            <Text style={styles.panelTitle}>가입하고 나에게 맞는 홈을 열어보세요</Text>
            <View style={styles.authButtonRow}>
              {/* ActionButton secondary는 흰 카드용이라 어두운 패널에선 안 보인다 - role 카드와
                  같은 톤으로 직접 스타일링한다. */}
              <Pressable
                accessibilityRole="button"
                style={styles.loginButton}
                onPress={() => setManualOnboarding({ step: 'sign-in' })}
              >
                <Text style={styles.loginButtonText}>로그인</Text>
              </Pressable>
              <View style={styles.authButtonHalf}>
                <ActionButton variant="gold" label="회원가입" onPress={() => setManualOnboarding({ step: 'welcome' })} />
              </View>
            </View>
            <Text style={styles.panelNote}>또는 이미 어떤 역할인지 알고 있다면 바로 골라주세요.</Text>
            <View style={[styles.roles, isWide && styles.rolesWide]}>
              {ROLE_OPTIONS.map(({ role, label, body }) => (
                <Pressable
                  key={role}
                  accessibilityRole="button"
                  style={styles.role}
                  onPress={() => setManualOnboarding({ step: 'sign-up', role })}
                >
                  <Text style={styles.roleLabel}>{label}</Text>
                  <Text style={styles.roleBody}>{body}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.panelNote}>
              기관 소속 선생님은 선생님으로 가입한 뒤, 관리자에게 받은 초대 코드로 기관에 연결해 주세요.
            </Text>
          </View>
        )}

        {/* Reachable only when homePathFor() can't place this role anywhere else (falls back to
            "/" itself) - every normal authenticated role is redirected away above, so there is
            no "내 홈으로" button here, just a way out via logout. */}
        {state.status === 'authenticated' && (
          <View style={[styles.panel, isWide && styles.panelWide]}>
            <Text style={styles.panelTitle}>{state.user.displayName}님, 다시 오셨네요</Text>
            <Pressable accessibilityRole="button" onPress={logout} style={styles.logoutButton}>
              <Text style={styles.link}>로그아웃</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.beta}>베타 서비스예요. 정식 출시를 준비하고 있어요.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: storybookTheme.color.background },
  scroll: {
    flex: 1,
    width: '100%',
    alignItems: 'stretch',
    gap: storybookTheme.spacing.lg,
    paddingHorizontal: storybookTheme.spacing.ml,
    paddingVertical: storybookTheme.spacing.lg,
  },
  header: {
    width: '100%',
    maxWidth: storybookTheme.layout.wideMaxWidth,
    alignSelf: 'center',
    alignItems: 'center',
    gap: storybookTheme.spacing.sm,
  },
  tagline: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.regular,
    color: storybookTheme.color.onContentMuted,
    textAlign: 'center',
  },
  panel: {
    width: '100%',
    maxWidth: storybookTheme.layout.dashboardCardMaxWidth,
    alignSelf: 'center',
    alignItems: 'stretch',
    gap: storybookTheme.spacing.ms,
    backgroundColor: storybookTheme.color.contentPanel,
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentPanelBorder,
    paddingHorizontal: storybookTheme.spacing.ml,
    paddingVertical: storybookTheme.spacing.ml,
  },
  // StoryLibraryGrid의 section과 같은 wideMaxWidth - 위아래 블록 너비를 맞춘다.
  panelWide: { maxWidth: storybookTheme.layout.wideMaxWidth },
  panelTitle: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onContent,
    textAlign: 'center',
  },
  authButtonRow: { flexDirection: 'row', gap: storybookTheme.spacing.sm, width: '100%' },
  authButtonHalf: { flex: 1 },
  loginButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: storybookTheme.radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: storybookTheme.color.contentPanel,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentPanelBorder,
  },
  loginButtonText: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onContent,
  },
  roles: { width: '100%', gap: storybookTheme.spacing.sm },
  rolesWide: { flexDirection: 'row' },
  role: {
    flex: 1,
    gap: storybookTheme.spacing.xs,
    backgroundColor: storybookTheme.color.contentPanel,
    borderRadius: storybookTheme.radius.card,
    paddingHorizontal: storybookTheme.spacing.md,
    paddingVertical: storybookTheme.spacing.ms,
  },
  roleLabel: { fontSize: storybookTheme.type.sm, fontWeight: storybookTheme.type.weight.black, color: storybookTheme.color.onContent },
  roleBody: {
    fontSize: storybookTheme.type.xs,
    lineHeight: storybookTheme.type.xs * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onContentMuted,
  },
  panelNote: {
    fontSize: storybookTheme.type.xs,
    lineHeight: storybookTheme.type.xs * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onContentMuted,
    textAlign: 'center',
  },
  logoutButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  link: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.linkOnDark,
    textAlign: 'center',
  },
  beta: { fontSize: storybookTheme.type.xxs, color: storybookTheme.color.onContentMuted, textAlign: 'center', marginTop: storybookTheme.spacing.xs },
});
