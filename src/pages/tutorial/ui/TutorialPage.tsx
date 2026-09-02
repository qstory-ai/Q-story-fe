import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, SafeAreaView, storybookTheme } from '@/shared/ui';

const TUTORIAL_SEEN_KEY = 'qstory.tutorial.seen.v1';

type Slide = {
  eyebrow: string;
  title: string;
  body: string;
  bullets?: string[];
};

/**
 * IA "튜토리얼" - 방문자가 앱을 처음 열 때 뜨는 3화면 안내. 건너뛰기는 언제든 가능하고, 완료
 * 하면 localStorage에 seen 마크가 남아 이후 재진입에는 뜨지 않는다(RootRedirect 참고).
 *
 * 부모/선생님 두 역할에서 공유하는 소개이므로 문구는 역할 구분 없이 두었다 - 역할별 세부
 * 소개(선생님용 "학생 리포트/보호자 연결")는 온보딩 안에서 이어진다. 튜토리얼은 서비스 자체를
 * 처음 만난 사람에게 서비스 컨셉을 짧게 전달하는 데만 집중한다.
 */
const SLIDES: Slide[] = [
  {
    eyebrow: '1 · Q-Story 소개',
    title: '아이의 질문이 이야기를 움직여요',
    body: '검수된 이야기를 함께 듣고, 아이가 궁금해할 순간에만 짧게 대화해요. 대화가 다음 장면과 리포트로 이어져요.',
  },
  {
    eyebrow: '2 · 핵심 기능',
    title: '이렇게 사용해요',
    body: '아이의 한마디로 다음 이야기를 정하고, 진행 뒤에는 부모/선생님이 리포트로 아이를 이해해요.',
    bullets: [
      '등장인물과 질문·대화하기',
      '질문에서 새로운 이야기가 이어지기',
      '아이의 질문·생각을 리포트로 확인하기',
    ],
  },
  {
    eyebrow: '3 · 시작하기',
    title: '준비됐어요',
    body: '지금 회원가입하면 아이를 위한 이야기 서재가 열려요. 이미 계정이 있다면 로그인해 주세요.',
  },
];

export function TutorialPage() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  function complete() {
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(TUTORIAL_SEEN_KEY, '1');
    } catch {
      // 프라이빗 모드 등에서 실패해도 튜토리얼은 이미 본 상태로 앱을 계속 쓸 수 있어야 한다.
    }
    navigate('/');
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.progressRow}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.progressPip, i <= index && styles.progressPipFilled]}
              accessibilityLabel={i === index ? `현재 ${i + 1}단계` : `${i + 1}단계`}
            />
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="튜토리얼 건너뛰기"
          onPress={complete}
          hitSlop={8}
        >
          <Text style={styles.skipLabel}>건너뛰기</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        <Text style={styles.eyebrow}>{slide.eyebrow}</Text>
        <Text style={styles.title} accessibilityRole="header">{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
        {slide.bullets ? (
          <View style={styles.bulletList}>
            {slide.bullets.map((bullet) => (
              <Text key={bullet} style={styles.bulletItem}>· {bullet}</Text>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        {isLast ? (
          <>
            <ActionButton variant="gold" label="회원가입하기" onPress={() => { complete(); navigate('/signup'); }} />
            <Pressable
              accessibilityRole="link"
              onPress={() => { complete(); navigate('/login'); }}
              style={styles.footerLink}
            >
              <Text style={styles.footerLinkText}>이미 계정이 있어요</Text>
            </Pressable>
          </>
        ) : (
          <ActionButton variant="gold" label="다음" onPress={() => setIndex((i) => Math.min(SLIDES.length - 1, i + 1))} />
        )}
      </View>
    </SafeAreaView>
  );
}

/** 튜토리얼을 이미 봤는지(재진입 시 자동 스킵할지) 판단. 서버 저장 없이 브라우저 로컬 마크만. */
export function hasSeenTutorial(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(TUTORIAL_SEEN_KEY) === '1';
  } catch {
    return true;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: storybookTheme.color.background },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  progressRow: { flexDirection: 'row', gap: 6, flex: 1 },
  progressPip: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: storybookTheme.color.panelOnDarkBorder,
    maxWidth: 60,
  },
  progressPipFilled: { backgroundColor: storybookTheme.color.gold },
  skipLabel: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.semibold,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 16,
    gap: 12,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    color: storybookTheme.color.gold,
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    letterSpacing: 0.4,
  },
  title: {
    color: storybookTheme.color.onDark,
    fontSize: storybookTheme.type.xxl,
    lineHeight: storybookTheme.type.xxl * storybookTheme.lineHeight.tight,
    fontWeight: storybookTheme.type.weight.black,
    letterSpacing: storybookTheme.type.xxl * storybookTheme.tracking.heading,
  },
  body: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.md,
    lineHeight: storybookTheme.type.md * storybookTheme.lineHeight.normal,
    marginTop: 6,
  },
  bulletList: { marginTop: 12, gap: 6 },
  bulletItem: {
    color: storybookTheme.color.onDark,
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
  },
  footer: {
    paddingHorizontal: 28,
    paddingVertical: 28,
    gap: 10,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  footerLink: { alignSelf: 'center', paddingVertical: 8 },
  footerLinkText: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    textDecorationLine: 'underline',
  },
});
