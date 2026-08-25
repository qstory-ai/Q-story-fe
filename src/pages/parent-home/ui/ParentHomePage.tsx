import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { SafeAreaView, storybookTheme } from '@/shared/ui';
import { useAuth } from '@/entities/auth';
import { listStories, type StoryCatalogEntry } from '@/entities/story';
import { StoryLibraryGrid } from '@/features/story-library';
import { formatReportDuration } from '@/pages/one-story';
import { listStoryCompletions, type StoryCompletionSummary } from '@/entities/story-completion';

type RecentLoad =
  | { status: 'loading' }
  | { status: 'ready'; completion: StoryCompletionSummary | null; title: string | null }
  | { status: 'error' };

/** 실제 시계에 기대는 값이라 컴포넌트 밖에서 한 번만 계산하지 않고, 렌더마다 새로 읽는다. */
function timeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return '좋은 아침이에요';
  if (hour < 18) return '좋은 오후예요';
  return '좋은 저녁이에요';
}

function formatCompletedAt(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(new Date(iso));
}

function latestOf(completions: StoryCompletionSummary[]) {
  return completions.reduce<StoryCompletionSummary | null>((latest, candidate) => {
    if (!latest) return candidate;
    return new Date(candidate.completedAt) > new Date(latest.completedAt) ? candidate : latest;
  }, null);
}

function titleFor(storyId: string, stories: StoryCatalogEntry[]) {
  return stories.find((story) => story.storyId === storyId)?.title ?? null;
}

/**
 * PARENT의 실제 홈("/parent") - homePathFor()가 PARENT를 항상 여기로 보내므로, 서재 그리드는
 * HomePage("/")로 링크만 걸지 않고 여기 그대로 임베드한다: 결제 가능성이 가장 높은 사용자층이
 * 그리드를 보려면 한 탭 거리가 아니라 바로 여기 있어야 한다. 원래 있던 단독 "이야기 시작하기"
 * 버튼은 그리드의 HG 카드가 같은 역할을 하므로 제거했다. "최근에 함께 읽은 이야기" 카드는
 * 실제 완주 기록(story-completions)으로 채운다 - 진행률처럼 아직 없는 데이터는 지어내지 않는다.
 */
export function ParentHomePage() {
  const navigate = useNavigate();
  const { state, logout } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 640;
  const [recent, setRecent] = useState<RecentLoad>({ status: 'loading' });

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'PARENT') {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  useEffect(() => {
    if (state.status !== 'authenticated') return;
    let cancelled = false;
    Promise.all([listStoryCompletions(state.token), listStories()])
      .then(([completions, stories]) => {
        if (cancelled) return;
        const completion = latestOf(completions);
        setRecent({
          status: 'ready',
          completion,
          title: completion ? titleFor(completion.storyId, stories) : null,
        });
      })
      .catch(() => {
        if (cancelled) return;
        // 부가 카드일 뿐이라 실패해도 조용히 숨긴다 - 핵심 CTA는 이 데이터 없이도 그대로 동작한다.
        setRecent({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [state]);

  if (state.status !== 'authenticated') return null;

  const recentReady = recent.status === 'ready' ? recent : null;
  const completion = recentReady?.completion ?? null;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <View style={styles.scroll}>
        <View style={[styles.card, isWide && styles.cardWide]}>
          <Text style={styles.eyebrow}>{timeOfDayGreeting()}</Text>
          <Text style={styles.title}>{state.user.displayName}님</Text>
          <Text style={styles.body}>아이와 함께 오늘의 이야기를 시작해 보세요.</Text>
        </View>

        <StoryLibraryGrid />

        {completion && (
          <Pressable
            onPress={() => navigate(`/reports/${completion.id}`)}
            accessibilityRole="link"
            style={({ pressed }) => [styles.recentCard, isWide && styles.recentCardWide, pressed && styles.pressed]}
          >
            <Text style={styles.recentLabel}>최근에 함께 읽었어요</Text>
            <Text style={styles.recentTitle}>{recentReady?.title ?? completion.storyId}</Text>
            <Text style={styles.recentMeta}>
              {formatCompletedAt(completion.completedAt)} · {formatReportDuration(completion.durationSeconds)}
            </Text>
            <Text style={styles.recentLink}>리포트 보기 →</Text>
          </Pressable>
        )}

        {recentReady && !completion && (
          <View style={[styles.recentCard, isWide && styles.recentCardWide]}>
            <Text style={styles.recentLabel}>아직 함께 읽은 이야기가 없어요</Text>
            <Text style={styles.recentMeta}>첫 이야기를 끝까지 읽으면 여기에 기록이 남아요.</Text>
          </View>
        )}

        <Pressable onPress={logout} accessibilityRole="button">
          <Text style={styles.logout}>로그아웃</Text>
        </Pressable>
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
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  card: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    alignItems: 'stretch',
    backgroundColor: storybookTheme.color.surfaceCard,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 28,
    gap: 10,
  },
  cardWide: { maxWidth: 760, paddingHorizontal: 40, paddingVertical: 36 },
  eyebrow: { fontSize: 12, fontWeight: '700', color: storybookTheme.color.error, letterSpacing: 0.4 },
  title: { fontSize: 22, fontWeight: '900', color: storybookTheme.color.onCardTitle },
  body: { fontSize: 14, lineHeight: 21, color: storybookTheme.color.onCardBody, marginTop: 2 },
  pressed: { opacity: 0.9 },
  recentCard: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    gap: 4,
    backgroundColor: storybookTheme.color.panelOnDarkBackground,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: storybookTheme.color.panelOnDarkBorder,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  recentCardWide: { maxWidth: 760 },
  recentLabel: { fontSize: 12, fontWeight: '700', color: storybookTheme.color.gold, letterSpacing: 0.3 },
  recentTitle: { fontSize: 17, fontWeight: '900', color: storybookTheme.color.onDark, marginTop: 2 },
  recentMeta: { fontSize: 13, color: storybookTheme.color.linkOnDark },
  recentLink: { fontSize: 13, fontWeight: '700', color: storybookTheme.color.gold, marginTop: 6 },
  logout: {
    fontSize: 13,
    color: storybookTheme.color.onDarkMuted,
    textAlign: 'center',
    fontWeight: '700',
  },
});
