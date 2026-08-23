import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, SafeAreaView } from '@/shared/ui';
import { homePathFor, useAuth } from '@/entities/auth';

/**
 * The entry point at "/". The anonymous demo used to live here, which left /login reachable only by
 * typing the URL; the first version of this page fixed that with three bare buttons and nothing
 * else, so anyone arriving from a shared link still had to guess what Q-Story was.
 *
 * Written on the story's own dark-and-cream surface rather than the auth pages' flat lilac: this is
 * the first thing a parent sees, and it should look like the thing they are about to open.
 *
 * The demo stays free and anonymous - the primary action goes straight to /demo with no auth check.
 */
export function HomePage() {
  const navigate = useNavigate();
  const { state, logout } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 720;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <View style={styles.scroll}>
        <View style={[styles.card, isWide && styles.cardWide]}>
          <Image
            source={{ uri: '/brand/q-story-question-book-logo.svg' }}
            resizeMode="contain"
            style={styles.logo}
            accessibilityLabel="Q-Story 로고"
          />
          <Text style={styles.wordmark}>
            <Text style={styles.wordmarkQ}>Q</Text>-STORY
          </Text>

          <Text style={[styles.headline, isWide && styles.headlineWide]}>
            아이가 질문하면{'\n'}이야기가 귀 기울여요
          </Text>
          <Text style={styles.subhead}>
            6~9세 아이와 부모님이 한 화면에서 듣고, 묻고, 함께 고르며 끝까지 읽는 동화예요.
          </Text>

          <View style={styles.cta}>
            <ActionButton label="이야기 시작하기" onPress={() => navigate('/demo')} />
            <Text style={styles.ctaNote}>가입 없이 무료로 한 편을 끝까지 볼 수 있어요.</Text>
          </View>

          <View style={[styles.steps, isWide && styles.stepsWide]}>
            {STEPS.map((step, index) => (
              <View key={step.title} style={styles.step}>
                <Text style={styles.stepIndex}>{index + 1}</Text>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepBody}>{step.body}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Nothing below the card until auth resolves - an account panel that flips to a sign-in
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

/** The product in three beats - the same loop the story runs, described before a child meets it. */
const STEPS = [
  { title: '듣기', body: '장면마다 그림과 함께 이야기를 들려줘요.' },
  { title: '묻기', body: '궁금해지면 말이나 글로 바로 물어볼 수 있어요.' },
  { title: '고르기', body: '질문에 맞춰 다음 행동을 함께 골라요.' },
];

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#28153F' },
  // Blocks are stretched and centred with textAlign / alignSelf rather than by centring the
  // column: a Text laid out by its own content in a centred column wraps at whatever width it
  // happens to want, which makes line breaks drift as copy is edited.
  scroll: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'stretch',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  card: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    alignItems: 'stretch',
    backgroundColor: 'rgba(255, 252, 245, 0.96)',
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 28,
    gap: 10,
  },
  cardWide: { maxWidth: 760, paddingHorizontal: 40, paddingVertical: 36 },
  logo: { width: 64, height: 64, alignSelf: 'center' },
  wordmark: {
    fontSize: 20,
    fontWeight: '900',
    color: '#43225F',
    letterSpacing: 2,
    textAlign: 'center',
  },
  wordmarkQ: { color: '#E46647' },
  headline: {
    fontSize: 26,
    lineHeight: 36,
    fontWeight: '900',
    color: '#43225F',
    textAlign: 'center',
    marginTop: 6,
  },
  headlineWide: { fontSize: 32, lineHeight: 44 },
  // Width comes from the card, not a second pixel cap here - two competing maxWidths is how the
  // measure ends up depending on which one happens to be smaller on a given screen.
  subhead: {
    fontSize: 14,
    lineHeight: 22,
    color: '#6B5478',
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  cta: { alignSelf: 'stretch', gap: 8, marginTop: 14 },
  ctaNote: { fontSize: 12, color: '#9C87AC', textAlign: 'center' },
  steps: { width: '100%', gap: 12, marginTop: 20 },
  stepsWide: { flexDirection: 'row', gap: 14 },
  step: {
    flex: 1,
    gap: 4,
    backgroundColor: '#F7F1FA',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  stepIndex: { fontSize: 11, fontWeight: '900', color: '#E46647' },
  stepTitle: { fontSize: 15, fontWeight: '900', color: '#43225F' },
  stepBody: { fontSize: 13, lineHeight: 19, color: '#6B5478' },
  panel: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    alignItems: 'stretch',
    gap: 12,
    backgroundColor: 'rgba(255, 252, 245, 0.08)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 252, 245, 0.16)',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  panelWide: { maxWidth: 760 },
  panelTitle: { fontSize: 15, fontWeight: '900', color: '#FFF7E9', textAlign: 'center' },
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
  roleLabel: { fontSize: 14, fontWeight: '900', color: '#F6C64D' },
  roleBody: { fontSize: 12.5, lineHeight: 18, color: '#DCD1FF' },
  panelNote: { fontSize: 12, lineHeight: 18, color: '#A899BD', textAlign: 'center' },
  link: { fontSize: 13, fontWeight: '700', color: '#DCD1FF', textAlign: 'center' },
  beta: { fontSize: 11.5, color: '#7A6A90', textAlign: 'center', marginTop: 4 },
});
