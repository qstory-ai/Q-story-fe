import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Navigate } from 'react-router-dom';

import { ActionButton, BrandLockup, SafeAreaView, storybookTheme } from '@/shared/ui';
import { homePathFor, useAuth } from '@/entities/auth';
import { StoryLibraryGrid } from '@/features/story-library';
import { OnboardingFlow } from '@/features/onboarding';

type OnboardingEntry = { step: 'welcome' | 'sign-up' | 'sign-in'; role?: 'PARENT' | 'DIRECTOR' | 'TUTOR' };

// IA의 회원 유형 분류에 맞춘 표기 - "방문 선생님"이라는 유형 라벨은 IA에서 삭제됐고
// (기관 소속 여부와 무관하게 모두 "선생님"), 실제 소속은 온보딩 이후에 결정된다.
const ROLE_OPTIONS: { role: 'DIRECTOR' | 'PARENT' | 'TUTOR'; label: string; body: string }[] = [
  { role: 'PARENT', label: '학부모님', body: '아이와 함께 이야기 서재를 시작해요' },
  { role: 'TUTOR', label: '선생님', body: '학생을 등록하고 수업을 준비해요' },
  { role: 'DIRECTOR', label: '기관 관리자', body: '유치원·기관을 등록하고 반을 만들어요' },
];

/**
 * "/"의 서재 홈. 이전에는 히어로 카드 + 3버튼짜리 화면이었는데, StoryCard/listStories()가
 * "홈 라이브러리 그리드용"으로 이미 만들어져 있었으면서도 어디에도 안 쓰이고 있던 걸 여기
 * 연결했다 - <StoryLibraryGrid />가 실제 책장이고, 언락 여부는 entities/story의
 * unlockStateFor()가 판단한다.
 *
 * 아래 auth 상태 패널(비로그인: 원장님/학부모님/방문 선생님/로그인 링크)은 그대로 보존한다 -
 * 예전엔 /director, /join, /login으로 직접 이동했지만, 이제는 같은 목적지를
 * <OnboardingFlow/>(환영→가치제안→역할선택→가입 순차 흐름)의 해당 단계로 곧장 진입시킨다 -
 * 원장님/학부모님/방문 선생님 카드는 역할이 이미 정해졌으니 role-select를 건너뛰고 바로
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
  const { width } = useWindowDimensions();
  const isWide = width >= 720;
  const [onboarding, setOnboarding] = useState<OnboardingEntry | null>(null);

  if (state.status === 'authenticated') {
    const homePath = homePathFor(state.user);
    if (homePath !== '/') {
      return <Navigate to={homePath} replace />;
    }
  }

  if (onboarding) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
        <OnboardingFlow initialStep={onboarding.step} initialRole={onboarding.role} onExit={() => setOnboarding(null)} />
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
                onPress={() => setOnboarding({ step: 'sign-in' })}
              >
                <Text style={styles.loginButtonText}>로그인</Text>
              </Pressable>
              <View style={styles.authButtonHalf}>
                <ActionButton variant="gold" label="회원가입" onPress={() => setOnboarding({ step: 'welcome' })} />
              </View>
            </View>
            <Text style={styles.panelNote}>또는 이미 어떤 역할인지 알고 있다면 바로 골라주세요.</Text>
            <View style={[styles.roles, isWide && styles.rolesWide]}>
              {ROLE_OPTIONS.map(({ role, label, body }) => (
                <Pressable
                  key={role}
                  accessibilityRole="link"
                  style={styles.role}
                  onPress={() => setOnboarding({ step: 'sign-up', role })}
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
    gap: 24,
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  header: {
    width: '100%',
    maxWidth: storybookTheme.layout.wideMaxWidth,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 8,
  },
  tagline: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.regular,
    color: storybookTheme.color.onDarkMuted,
    textAlign: 'center',
  },
  panel: {
    width: '100%',
    maxWidth: storybookTheme.layout.dashboardCardMaxWidth,
    alignSelf: 'center',
    alignItems: 'stretch',
    gap: 12,
    backgroundColor: storybookTheme.color.panelOnDarkBackground,
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    borderColor: storybookTheme.color.panelOnDarkBorder,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  // StoryLibraryGrid의 section도 wideMaxWidth(1040)를 쓴다 - 위아래 블록의 실제 너비가
  // 같아야 한 화면처럼 정렬돼 보인다(예전엔 이 패널만 760으로 좁아서 위 서재 영역보다
  // 눈에 띄게 좁아 보였다).
  panelWide: { maxWidth: storybookTheme.layout.wideMaxWidth },
  panelTitle: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onDark,
    textAlign: 'center',
  },
  authButtonRow: { flexDirection: 'row', gap: 10, width: '100%' },
  authButtonHalf: { flex: 1 },
  loginButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 252, 245, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
  },
  loginButtonText: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onDark,
  },
  roles: { width: '100%', gap: 10 },
  rolesWide: { flexDirection: 'row' },
  role: {
    flex: 1,
    gap: 3,
    // panelOnDarkBackground(0.08)와 같은 크림 계열 - 이전엔 0.1로 미세하게 달랐다.
    backgroundColor: storybookTheme.color.panelOnDarkBackground,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  roleLabel: { fontSize: storybookTheme.type.sm, fontWeight: storybookTheme.type.weight.black, color: storybookTheme.color.gold },
  roleBody: {
    fontSize: storybookTheme.type.xs,
    lineHeight: storybookTheme.type.xs * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onDarkMuted,
  },
  panelNote: {
    fontSize: storybookTheme.type.xs,
    lineHeight: storybookTheme.type.xs * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onDarkMuted,
    textAlign: 'center',
  },
  link: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.linkOnDark,
    textAlign: 'center',
  },
  beta: { fontSize: storybookTheme.type.xxs, color: storybookTheme.color.onDarkMuted, textAlign: 'center', marginTop: 4 },
});
