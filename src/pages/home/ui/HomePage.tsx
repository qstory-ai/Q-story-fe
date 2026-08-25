import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, BrandLockup, SafeAreaView, storybookTheme } from '@/shared/ui';
import { homePathFor, useAuth } from '@/entities/auth';
import { StoryLibraryGrid } from '@/features/story-library';

/**
 * "/"의 서재 홈. 이전에는 히어로 카드 + 3버튼짜리 화면이었는데, StoryCard/listStories()가
 * "홈 라이브러리 그리드용"으로 이미 만들어져 있었으면서도 어디에도 안 쓰이고 있던 걸 여기
 * 연결했다 - <StoryLibraryGrid />가 실제 책장이고, 언락 여부는 entities/story의
 * unlockStateFor()가 판단한다.
 *
 * 아래 auth 상태 패널(비로그인: 원장님/학부모님/로그인 링크, 로그인: 웰컴백+로그아웃)은
 * 그대로 보존한다 - /director, /join, /login으로 가는 유일한 경로이기 때문이다(원래 주석대로,
 * 이 패널이 없으면 /login은 주소를 직접 쳐야만 닿을 수 있다).
 *
 * 데모는 여전히 무료·익명이다 - 그리드의 HG 카드가 곧장 /demo로 보낸다.
 */
export function HomePage() {
  const navigate = useNavigate();
  const { state, logout } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 720;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <View style={styles.scroll}>
        <View style={styles.header}>
          <BrandLockup />
          <Text style={styles.tagline}>아이가 질문하면 이야기가 귀 기울여요</Text>
        </View>

        <StoryLibraryGrid />

        {/* Nothing below the grid until auth resolves - an account panel that flips to a sign-in
            panel a moment later reads as a glitch. */}
        {state.status === 'anonymous' && (
          <View style={[styles.panel, isWide && styles.panelWide]}>
            <Text style={styles.panelTitle}>유치원에서 쓰고 계신가요?</Text>
            <View style={[styles.roles, isWide && styles.rolesWide]}>
              <Pressable
                accessibilityRole="link"
                style={styles.role}
                onPress={() => navigate('/director')}
              >
                <Text style={styles.roleLabel}>원장님</Text>
                <Text style={styles.roleBody}>유치원을 등록하고 반을 만들어요</Text>
              </Pressable>
              <Pressable
                accessibilityRole="link"
                style={styles.role}
                onPress={() => navigate('/join')}
              >
                <Text style={styles.roleLabel}>학부모님</Text>
                <Text style={styles.roleBody}>반 코드를 받아 참여해요</Text>
              </Pressable>
            </View>
            {/* Class accounts are issued by a director, so there is nothing to sign up for here -
                saying so is kinder than a third card that leads nowhere. */}
            <Text style={styles.panelNote}>
              선생님은 원장님께 받은 반 아이디로 로그인해 주세요.
            </Text>
            <Pressable accessibilityRole="link" onPress={() => navigate('/login')}>
              <Text style={styles.link}>이미 계정이 있어요 · 로그인</Text>
            </Pressable>
          </View>
        )}

        {state.status === 'authenticated' && (
          <View style={[styles.panel, isWide && styles.panelWide]}>
            <Text style={styles.panelTitle}>{state.user.displayName}님, 다시 오셨네요</Text>
            <ActionButton
              variant="secondaryFull"
              label="내 홈으로"
              onPress={() => navigate(homePathFor(state.user))}
            />
            <Pressable accessibilityRole="button" onPress={logout}>
              <Text style={styles.link}>로그아웃</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.beta}>베타 서비스예요. 함께 만들어 주셔서 고맙습니다.</Text>
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
    fontWeight: '400',
    color: storybookTheme.color.onDarkMuted,
    textAlign: 'center',
  },
  panel: {
    width: '100%',
    maxWidth: 640,
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
  panelWide: { maxWidth: 760 },
  panelTitle: { fontSize: 15, fontWeight: '900', color: storybookTheme.color.onDark, textAlign: 'center' },
  roles: { width: '100%', gap: 10 },
  rolesWide: { flexDirection: 'row' },
  role: {
    flex: 1,
    gap: 3,
    backgroundColor: 'rgba(255, 252, 245, 0.1)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  roleLabel: { fontSize: 14, fontWeight: '900', color: storybookTheme.color.gold },
  roleBody: { fontSize: 12.5, lineHeight: 18, color: storybookTheme.color.onDarkMuted },
  panelNote: { fontSize: 12, lineHeight: 18, color: storybookTheme.color.onDarkMuted, textAlign: 'center' },
  link: { fontSize: 13, fontWeight: '700', color: storybookTheme.color.linkOnDark, textAlign: 'center' },
  beta: { fontSize: 11.5, color: storybookTheme.color.onDarkMuted, textAlign: 'center', marginTop: 4 },
});
