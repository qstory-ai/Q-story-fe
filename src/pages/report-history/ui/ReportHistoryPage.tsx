import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, AppNavShell, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, homePathFor, useAuth } from '@/entities/auth';
import { listStories, StoryApiError } from '@/entities/story';
import { formatReportDuration } from '@/pages/one-story';
import { buildRecentApproachTrend, type RecentApproachTrend } from '@/entities/analytics';
import {
  listRecentStoryCompletions,
  listStoryCompletions,
  StoryCompletionApiError,
  type StoryCompletionSummary,
} from '@/entities/story-completion';

/** 트렌드 카드가 내려다보는 최근 회차 수 - 1~2회로는 "반복"이라 부르기 애매해 최소 2회 겹쳐야 표시한다. */
const RECENT_TREND_LIMIT = 5;

type LoadState =
  | { status: 'loading' }
  | {
      status: 'ready';
      completions: StoryCompletionSummary[];
      titleByStoryId: Record<string, string>;
      recentTrend: RecentApproachTrend | null;
    }
  | { status: 'error'; message: string };

function formatCompletedAt(iso: string) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

/** 로그인한 부모/학급 계정의 지난 "오늘의 질문 기록" 리포트 목록, 최신순 정렬. */
export function ReportHistoryPage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });

  const canView = state.status === 'authenticated' && (state.user.role === 'PARENT' || state.user.role === 'CLASS_ACCOUNT');

  useEffect(() => {
    if (state.status === 'loading') return;
    if (!canView) {
      navigate('/', { replace: true });
    }
  }, [state.status, canView, navigate]);

  useEffect(() => {
    if (state.status !== 'authenticated') return;
    let cancelled = false;
    Promise.all([
      listStoryCompletions(state.token),
      listStories(),
      // 트렌드 카드는 부가 기능이므로, 이 호출이 실패해도(예: 구버전 백엔드) 목록/상세 조회 자체는
      // 계속 동작해야 한다 - 실패를 빈 배열로 흡수해 recentTrend가 조용히 null로 남게 한다.
      listRecentStoryCompletions(state.token, RECENT_TREND_LIMIT).catch(() => []),
    ])
      .then(([completions, stories, recentCompletions]) => {
        if (cancelled) return;
        setLoad({
          status: 'ready',
          completions,
          titleByStoryId: Object.fromEntries(stories.map((story) => [story.storyId, story.title])),
          recentTrend:
            recentCompletions.length >= 2 ? buildRecentApproachTrend(recentCompletions) : null,
        });
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        const message =
          failure instanceof StoryCompletionApiError || failure instanceof StoryApiError
            ? failure.message
            : '기록을 불러오지 못했어요.';
        setLoad({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [state]);

  if (!canView) return null;

  return (
    <AppNavShell
      items={dashboardNavItems(state.user, navigate, 'reports')}
      onBack={() => navigate('/mypage')}
    >
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">지난 리포트</Text>
        <Text style={styles.subtitle}>아이가 이야기를 마칠 때마다 남긴 질문 기록이에요.</Text>

        {load.status === 'loading' && (
          <View style={styles.centerBox}>
            <ActivityIndicator color={storybookTheme.color.gold} />
          </View>
        )}

        {load.status === 'error' && (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>{load.message}</Text>
          </View>
        )}

        {load.status === 'ready' && load.recentTrend?.repeatedApproach && (
          <View style={styles.trendCard}>
            <Text style={styles.trendEyebrow}>
              최근 {load.recentTrend.sessionCount}회 동안 반복된 접근
            </Text>
            <Text style={styles.trendTitle}>‘{load.recentTrend.repeatedApproach.label}’</Text>
            <Text style={styles.trendBody}>
              {load.recentTrend.repeatedApproach.count}번의 장면에서 이 방식을 골랐어요. 오늘 하루가
              아니라 최근 흐름에서 나온 경향이에요 - 성격이나 발달을 판단하는 진단은 아니에요.
            </Text>
          </View>
        )}

        {load.status === 'ready' && load.completions.length === 0 && (
          <View style={styles.centerBox}>
            <Text style={styles.emptyText}>아직 마친 이야기가 없어요. 이야기를 끝까지 읽으면 여기에 기록이 남아요.</Text>
            <ActionButton
              variant="secondary"
              label="홈으로"
              onPress={() => navigate(state.status === 'authenticated' ? homePathFor(state.user) : '/')}
            />
          </View>
        )}

        {load.status === 'ready' &&
          load.completions.map((completion) => (
            <Pressable
              key={completion.id}
              onPress={() => navigate(`/reports/${completion.id}`)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.reportCard, pressed && styles.reportCardPressed]}
            >
              <Text style={styles.reportCardTitle}>
                {load.titleByStoryId[completion.storyId] ?? completion.storyId}
              </Text>
              <Text style={styles.reportCardMeta}>
                {formatCompletedAt(completion.completedAt)} · {formatReportDuration(completion.durationSeconds)}
              </Text>
            </Pressable>
          ))}
      </View>
    </AppNavShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    width: '100%',
    maxWidth: storybookTheme.layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 16,
  },
  title: {
    fontSize: storybookTheme.type.xl,
    fontWeight: '600',
    color: storybookTheme.color.onDark,
  },
  subtitle: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.onDarkMuted,
  },
  centerBox: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 24,
  },
  errorText: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.sm,
    textAlign: 'center',
  },
  emptyText: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.sm,
    textAlign: 'center',
  },
  trendCard: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.gold,
    padding: 18,
    gap: 6,
    ...storybookTheme.elevation.low,
  },
  trendEyebrow: {
    fontSize: storybookTheme.type.xs,
    fontWeight: '600',
    color: storybookTheme.color.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  trendTitle: {
    fontSize: storybookTheme.type.md,
    lineHeight: storybookTheme.type.md * storybookTheme.lineHeight.normal,
    fontWeight: '600',
    color: storybookTheme.color.onCardTitle,
  },
  trendBody: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onCardMuted,
  },
  reportCard: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    padding: 18,
    gap: 4,
    transform: [{ scale: 1 }],
    ...storybookTheme.elevation.low,
  },
  reportCardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  reportCardTitle: {
    fontSize: storybookTheme.type.md,
    lineHeight: storybookTheme.type.md * storybookTheme.lineHeight.normal,
    fontWeight: '600',
    color: storybookTheme.color.onCardTitle,
  },
  reportCardMeta: {
    fontSize: storybookTheme.type.xs,
    fontWeight: '400',
    color: storybookTheme.color.onCardMuted,
  },
});
