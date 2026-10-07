import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { trackLandingCta, trackLandingView } from '@/entities/analytics';
import { ActionButton, SafeAreaView, storybookTheme } from '@/shared/ui';

const TUTORIAL_SEEN_KEY = 'qstory.tutorial.seen.v1';

const BULLETS = [
  '등장인물과 질문·대화하기',
  '질문에서 새로운 이야기가 이어지기',
  '아이의 질문·생각을 리포트로 확인하기',
];

/**
 * IA "튜토리얼" - 방문자가 앱을 처음 열 때 한 번 뜨는 소개. 서비스 소개는 이 화면 한 곳에서만 한다 - 예전의
 * 3장 슬라이드·가입 화면의 환영 단계·가입 직후 캐러셀이 같은 소개를 반복해 한 화면으로 합쳤다(Q-36).
 * 보호자는 여기서 바로 보호자 가입 폼으로 간다(역할 선택 단계 생략). 어떤 버튼으로 떠나든 localStorage에
 * seen 마크가 남아 이후 재진입에는 뜨지 않는다(HomePage의 hasSeenTutorial 참고).
 */
export function TutorialPage() {
  const navigate = useNavigate();

  // 앱 안의 소개 화면 - 웹사이트 소개를 본 뒤 가입·로그인·둘러보기 중 어디로 가는지 본다(Q-40 UT).
  useEffect(() => {
    trackLandingView('tutorial');
  }, []);

  function completeTo(path: string) {
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(TUTORIAL_SEEN_KEY, '1');
    } catch {
      // 프라이빗 모드 등에서 실패해도 튜토리얼은 이미 본 상태로 앱을 계속 쓸 수 있어야 한다.
    }
    navigate(path);
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.container}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="소개 건너뛰고 서재 둘러보기"
          onPress={() => {
            trackLandingCta('tutorial_skip');
            completeTo('/');
          }}
          hitSlop={8}
        >
          <Text style={styles.skipLabel}>둘러보기</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        <Text style={styles.eyebrow}>Q-Story 소개</Text>
        <Text style={styles.title} accessibilityRole="header">아이의 질문이 이야기를 움직여요</Text>
        <Text style={styles.body}>
          검수된 이야기를 함께 듣고, 아이가 궁금해할 순간에만 짧게 대화해요. 대화가 다음 장면과 리포트로 이어져요.
        </Text>
        <View style={styles.bulletList}>
          {BULLETS.map((bullet) => (
            <Text key={bullet} style={styles.bulletItem}>· {bullet}</Text>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <ActionButton
          variant="gold"
          label="보호자로 시작하기"
          onPress={() => {
            trackLandingCta('tutorial_signup_parent');
            completeTo('/signup?role=parent');
          }}
        />
        <ActionButton
          variant="secondaryFull"
          label="선생님·기관으로 시작하기"
          onPress={() => {
            trackLandingCta('tutorial_signup_teacher');
            completeTo('/signup');
          }}
        />
        <Pressable
          accessibilityRole="link"
          onPress={() => {
            trackLandingCta('tutorial_login');
            completeTo('/login');
          }}
          style={styles.footerLink}
        >
          <Text style={styles.footerLinkText}>이미 계정이 있어요</Text>
        </Pressable>
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
    justifyContent: 'flex-end',
    gap: 12,
  },
  skipLabel: {
    color: storybookTheme.color.onContentMuted,
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
    color: storybookTheme.color.goldText,
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    letterSpacing: 0.4,
  },
  title: {
    color: storybookTheme.color.onContent,
    fontSize: storybookTheme.type.xxl,
    lineHeight: storybookTheme.type.xxl * storybookTheme.lineHeight.tight,
    fontWeight: storybookTheme.type.weight.black,
    letterSpacing: storybookTheme.type.xxl * storybookTheme.tracking.heading,
  },
  body: {
    color: storybookTheme.color.onContentMuted,
    fontSize: storybookTheme.type.md,
    lineHeight: storybookTheme.type.md * storybookTheme.lineHeight.normal,
    marginTop: 6,
  },
  bulletList: { marginTop: 12, gap: 6 },
  bulletItem: {
    color: storybookTheme.color.onContent,
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
    color: storybookTheme.color.onContentMuted,
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    textDecorationLine: 'underline',
  },
});
