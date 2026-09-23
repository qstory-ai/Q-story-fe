import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import { ActionButton, BrandLockup, SafeAreaView, storybookTheme } from '@/shared/ui';
import { homePathFor, useAuth } from '@/entities/auth';
import { StoryLibraryGrid } from '@/features/story-library';
import { OnboardingFlow, type TutorInviteRef } from '@/features/onboarding';
import { hasSeenTutorial } from '@/pages/tutorial';

type OnboardingEntry = {
  step: 'welcome' | 'sign-up' | 'sign-in' | 'tutor-preview';
  role?: 'PARENT' | 'DIRECTOR' | 'TUTOR';
  invite?: string;
  tutorInvite?: TutorInviteRef;
};

/**
 * `?flow=sign-in|sign-up|welcome|tutor-invite` + 선택적 `?role=parent|organization|tutor` +
 * 선택적 `?invite=<token>` (기관 반코드 초대) + `flow=tutor-invite`일 때 `?token=<rawToken>` 또는
 * `?code=<shortCode>` (선생님-학부모 초대)를 OnboardingEntry로 정규화한다. `/login`, `/signup`,
 * `/join`, `/tutor-invite/...` 얇은 리다이렉트가 이 파라미터들을 붙여 홈으로 보낸다 - 여러 경로가
 * 별도 페이지가 아니라 홈의 온보딩 흐름 안으로 흡수되도록.
 */
function readOnboardingParams(params: URLSearchParams): OnboardingEntry | null {
  const flow = params.get('flow');
  if (flow === 'tutor-invite') {
    const token = params.get('token');
    const code = params.get('code');
    // token/code가 둘 다 없어도(잘린 공유 문구 등) 조용히 홈으로 보내지 않고 온보딩 흐름이 "올바르지
    // 않은 초대"를 보여 주도록 빈 값을 넘긴다.
    const tutorInvite: TutorInviteRef = token
      ? { value: token, isCode: false }
      : { value: code ?? '', isCode: true };
    return { step: 'tutor-preview', role: 'PARENT', tutorInvite };
  }
  if (flow !== 'sign-in' && flow !== 'sign-up' && flow !== 'welcome') return null;
  if (flow === 'sign-in') return { step: 'sign-in' };
  if (flow === 'welcome') return { step: 'welcome' };
  const invite = params.get('invite');
  const roleParam = params.get('role');
  const role: OnboardingEntry['role'] =
    invite
      ? 'PARENT'
      : roleParam === 'organization'
        ? 'DIRECTOR'
        : roleParam === 'tutor'
          ? 'TUTOR'
          : roleParam === 'parent'
            ? 'PARENT'
            : undefined;
  return role ? { step: 'sign-up', role, invite: invite ?? undefined } : { step: 'welcome' };
}

// IA의 회원 유형 분류에 맞춘 표기 - 기관 소속 여부와 무관하게 모두 "선생님"으로 표기하고,
// 실제 소속은 온보딩 이후에 결정된다.
const ROLE_OPTIONS: { role: 'DIRECTOR' | 'PARENT' | 'TUTOR'; label: string; body: string }[] = [
  { role: 'PARENT', label: '학부모님', body: '아이와 함께 이야기 서재를 시작해요' },
  { role: 'TUTOR', label: '선생님', body: '학생을 등록하고 수업을 준비해요' },
  // OnboardingFlow의 ROLE_CARDS와 같은 표기("기관 및 단체") - 예전엔 여기만 "기관 관리자"라
  // 카드를 눌러 들어간 다음 화면에서 이름이 달라졌다.
  { role: 'DIRECTOR', label: '기관 및 단체', body: '유치원·기관을 등록하고 반을 만들어요' },
];

/**
 * "/"의 서재 홈. 이전에는 히어로 카드 + 3버튼짜리 화면이었는데, StoryCard/listStories()가
 * "홈 라이브러리 그리드용"으로 이미 만들어져 있었으면서도 어디에도 안 쓰이고 있던 걸 여기
 * 연결했다 - <StoryLibraryGrid />가 실제 책장이고, 언락 여부는 entities/story의
 * unlockStateFor()가 판단한다.
 *
 * 아래 auth 상태 패널(비로그인: 원장님/학부모님/선생님/로그인 링크)은 그대로 보존한다 -
 * 예전엔 /director, /join, /login으로 직접 이동했지만, 이제는 같은 목적지를
 * <OnboardingFlow/>(환영→가치제안→역할선택→가입 순차 흐름)의 해당 단계로 곧장 진입시킨다 -
 * 원장님/학부모님/선생님 카드는 역할이 이미 정해졌으니 role-select를 건너뛰고 바로
 * sign-up 단계로. 기존 라우트 중 여전히 살아있는 /join, /login, /signup, /organization은
 * 딥링크·북마크 보호를 위해 그대로 둔다 - 다만 /director는 완전히 죽은 코드였다(가입 단계가
 * 존재하지 않는 백엔드 엔드포인트를 불렀고, 인증 후에는 항상 동일한 기능의 /organization으로
 * 갔어야 했던 중복 페이지라 삭제했다 - homePathFor()도 이제 /organization을 가리킨다).
 *
 * 로그인된 사용자는 "/"에 들어와도 이 화면을 보지 않는다 - 역할 홈으로 즉시 리다이렉트한다.
 * homePathFor()가 "/"를 반환하는(알 수 없는 role) 경우에만 리다이렉트 루프를 막기 위해
 * 이 화면을 그대로 보여준다.
 *
 * 데모는 여전히 무료·익명이다 - 그리드의 HG 카드가 곧장 /demo로 보낸다.
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
  // OnboardingFlow가 이 화면 안에서 세션을 만들었다(가입 직후 / 초대 수락 직후). 그 순간 아래
  // "로그인됐으면 역할 홈으로" 리다이렉트가 끼어들면 캐러셀·아이 등록 단계를 못 보고 홈으로 튕긴다 -
  // 흐름이 스스로 navigate(replace)로 떠날 때까지 리다이렉트를 보류한다.
  const [flowOwnsSession, setFlowOwnsSession] = useState(false);

  // 선생님 초대(tutor-preview)는 이미 로그인된 학부모도 열 수 있어야 한다 - 마이페이지 > 수업
  // 연결에서 링크를 붙여넣는 경우가 그렇다. 이 경우엔 역할 홈으로 튕기지 않고 온보딩 흐름 안에서
  // 미리보기→동의까지 마치게 둔다(OnboardingFlow가 이미 인증된 세션이면 계정 단계를 건너뛰고,
  // 학부모가 아닌 역할이면 로그아웃 안내를 보여 준다).
  if (state.status === 'authenticated' && !flowOwnsSession && onboarding?.step !== 'tutor-preview') {
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
          initialInvite={onboarding.invite}
          initialTutorInvite={onboarding.tutorInvite}
          // URL 파라미터(/login, /join, 초대 링크)로 들어온 경우엔 state를 비워도 paramEntry가
          // 계속 이기므로 "← 서재로"가 아무 일도 안 했다 - 파라미터 없는 "/"로 실제로 이동한다.
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
              {/* ActionButton의 secondary 변형은 흰 카드 위에서 쓰도록 만들어져 있어(연한
                  회색 배경 + 진보라 글자) 이 패널의 어두운 배경에선 거의 안 보였다 - role
                  카드와 같은 "어두운 배경용 반투명" 톤으로 직접 스타일링한다. */}
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
                  accessibilityRole="link"
                  style={styles.role}
                  onPress={() => setManualOnboarding({ step: 'sign-up', role })}
                >
                  <Text style={styles.roleLabel}>{label}</Text>
                  <Text style={styles.roleBody}>{body}</Text>
                </Pressable>
              ))}
            </View>
            {/* 기관 소속 선생님(class account)은 원장이 발급한 반 아이디로 로그인하므로 여기서 별도
                가입 카드는 만들지 않는다 - 안내 문구로만 존재를 알려 준다. */}
            <Text style={styles.panelNote}>
              기관 소속 선생님은 관리자에게 받은 반 아이디로 로그인해 주세요.
            </Text>
          </View>
        )}

        {/* Reachable only when homePathFor() can't place this role anywhere else (falls back to
            "/" itself) - every normal authenticated role is redirected away above, so there is
            no "내 홈으로" button here, just a way out via logout. */}
        {state.status === 'authenticated' && (
          <View style={[styles.panel, isWide && styles.panelWide]}>
            <Text style={styles.panelTitle}>{state.user.displayName}님, 다시 오셨네요</Text>
            <Pressable accessibilityRole="button" onPress={logout}>
              <Text style={styles.link}>로그아웃</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.beta}>베타 서비스로, 정식 출시를 앞두고 있습니다.</Text>
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
  // StoryLibraryGrid의 section도 wideMaxWidth(1040)를 쓴다 - 위아래 블록의 실제 너비가
  // 같아야 한 화면처럼 정렬돼 보인다(예전엔 이 패널만 760으로 좁아서 위 서재 영역보다
  // 눈에 띄게 좁아 보였다).
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
    // panelOnDarkBackground(0.08)와 같은 크림 계열 - 이전엔 0.1로 미세하게 달랐다.
    backgroundColor: storybookTheme.color.contentPanel,
    borderRadius: storybookTheme.radius.card,
    paddingHorizontal: storybookTheme.spacing.md,
    paddingVertical: storybookTheme.spacing.ms,
  },
  roleLabel: { fontSize: storybookTheme.type.sm, fontWeight: storybookTheme.type.weight.black, color: storybookTheme.color.goldText },
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
  link: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.linkOnDark,
    textAlign: 'center',
  },
  beta: { fontSize: storybookTheme.type.xxs, color: storybookTheme.color.onContentMuted, textAlign: 'center', marginTop: storybookTheme.spacing.xs },
});
