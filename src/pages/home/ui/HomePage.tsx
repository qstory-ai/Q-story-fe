import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, SafeAreaView } from '@/shared/ui';
import { homePathFor, useAuth } from '@/entities/auth';

/**
 * The entry point at "/". The anonymous demo used to live here, which left /login reachable only by
 * typing the URL - every signed-in surface is now one tap away instead.
 *
 * The demo stays free and anonymous: "이야기 시작하기" goes straight to /demo with no auth check.
 */
export function HomePage() {
  const navigate = useNavigate();
  const { state, logout } = useAuth();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.content}>
        <Image
          source={{ uri: '/brand/q-story-question-book-logo.svg' }}
          resizeMode="contain"
          style={styles.logo}
          accessibilityLabel="Q-Story 로고"
        />
        <Text style={styles.title}>
          <Text style={styles.titleQ}>Q</Text>-STORY
        </Text>
        <Text style={styles.tagline}>아이가 묻고, 이야기가 답해요.</Text>

        <View style={styles.actions}>
          <ActionButton label="이야기 시작하기" onPress={() => navigate('/demo')} />

          {/* Nothing below the demo button until auth resolves - a "로그인" that flips to
              "내 홈으로" a moment later reads as a glitch. */}
          {state.status === 'anonymous' && (
            <>
              <ActionButton
                variant="secondaryFull"
                label="로그인"
                onPress={() => navigate('/login')}
              />
              <View style={styles.links}>
                <Pressable onPress={() => navigate('/director')} accessibilityRole="link">
                  <Text style={styles.link}>원장이신가요? 유치원 등록하기</Text>
                </Pressable>
                <Pressable onPress={() => navigate('/join')} accessibilityRole="link">
                  <Text style={styles.link}>학부모이신가요? 반 코드로 가입하기</Text>
                </Pressable>
              </View>
            </>
          )}

          {state.status === 'authenticated' && (
            <>
              <ActionButton
                variant="secondaryFull"
                label={`${state.user.displayName}님, 내 홈으로`}
                onPress={() => navigate(homePathFor(state.user))}
              />
              <View style={styles.links}>
                <Pressable onPress={logout} accessibilityRole="button">
                  <Text style={styles.link}>로그아웃</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F1FB',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 32,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  logo: {
    width: 72,
    height: 72,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#43225F',
    letterSpacing: 1,
  },
  titleQ: {
    color: '#E46647',
  },
  tagline: {
    fontSize: 14,
    color: '#6B5478',
    textAlign: 'center',
    marginBottom: 20,
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  links: {
    marginTop: 4,
    gap: 8,
    alignItems: 'center',
  },
  link: {
    color: '#7A4FA0',
    fontSize: 13,
    fontWeight: '700',
  },
});
