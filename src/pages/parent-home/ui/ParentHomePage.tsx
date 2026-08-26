import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { AppNavShell, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, useAuth } from '@/entities/auth';
import { listStories, type StoryCatalogEntry } from '@/entities/story';
import { StoryLibraryGrid } from '@/features/story-library';
import { formatReportDuration } from '@/pages/one-story';
import { listStoryCompletions, type StoryCompletionSummary } from '@/entities/story-completion';
import { listParentTutorReports, type TutorReportSummary } from '@/entities/tutor';

type RecentLoad =
  | { status: 'loading' }
  | { status: 'ready'; completion: StoryCompletionSummary | null; title: string | null }
  | { status: 'error' };

type TutorReportsLoad = { status: 'loading' } | { status: 'ready'; reports: TutorReportSummary[] } | { status: 'error' };

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
  const { state } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 640;
  const [recent, setRecent] = useState<RecentLoad>({ status: 'loading' });
  const [tutorReports, setTutorReports] = useState<TutorReportsLoad>({ status: 'loading' });

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

  // 별도 effect로 둔다 - 이 카드가 실패해도 위 "최근에 함께 읽었어요" 카드는 그대로 동작해야 한다.
  useEffect(() => {
    if (state.status !== 'authenticated') return;
    let cancelled = false;
    listParentTutorReports(state.token)
      .then((reports) => {
        if (!cancelled) setTutorReports({ status: 'ready', reports });
      })
      .catch(() => {
        if (!cancelled) setTutorReports({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [state]);

  if (state.status !== 'authenticated') return null;

  const recentReady = recent.status === 'ready' ? recent : null;
  const completion = recentReady?.completion ?? null;

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, 'home')}>
      <View style={styles.scroll}>
        <View style={[styles.card, isWide && styles.cardWide]}>
          <Text style={styles.eyebrow}>{timeOfDayGreeting()}</Text>
          <Text style={styles.title} accessibilityRole="header">{state.user.displayName}님</Text>
          <Text style={styles.body}>아이와 함께 오늘의 이야기를 시작해 보세요.</Text>
        </View>

        <StoryLibraryGrid />

        {tutorReports.status === 'ready' && tutorReports.reports.length > 0 && (
          <View style={[styles.recentCard, isWide && styles.recentCardWide]}>
            <Text style={styles.recentLabel}>선생님에게 받은 기록</Text>
            {/* /reports/:id는 완주 기록을 만든 계정(=선생님) 것만 조회할 수 있어서, 부모 쪽에서는
                아직 상세 화면으로 연결하지 않는다 - 공유 리포트 상세 조회는 다음 단계로 미룬다. */}
            {tutorReports.reports.map((report) => (
              <View key={report.id} style={styles.tutorReportRow}>
                <Text style={styles.recentTitle}>{report.tutorDisplayName} · {report.studentName}</Text>
                <Text style={styles.recentMeta}>
                  {formatCompletedAt(report.completedAt)} · {formatReportDuration(report.durationSeconds)}
                </Text>
              </View>
            ))}
          </View>
        )}

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
      </View>
    </AppNavShell>
  );
}

const styles = StyleSheet.create({
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
    maxWidth: storybookTheme.layout.dashboardCardMaxWidth,
    alignSelf: 'center',
    alignItems: 'stretch',
    backgroundColor: storybookTheme.color.surfaceCard,
    borderRadius: storybookTheme.radius.card,
    paddingHorizontal: 24,
    paddingVertical: 28,
    gap: 10,
  },
  cardWide: {
    maxWidth: storybookTheme.layout.dashboardCardWideMaxWidth,
    paddingHorizontal: 40,
    paddingVertical: 36,
  },
  eyebrow: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.error,
    letterSpacing: 0.4,
  },
  title: { fontSize: storybookTheme.type.lg, fontWeight: storybookTheme.type.weight.black, color: storybookTheme.color.onCardTitle },
  body: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onCardBody,
    marginTop: 2,
  },
  pressed: { opacity: 0.9 },
  recentCard: {
    width: '100%',
    maxWidth: storybookTheme.layout.dashboardCardMaxWidth,
    alignSelf: 'center',
    gap: 4,
    backgroundColor: storybookTheme.color.panelOnDarkBackground,
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    borderColor: storybookTheme.color.panelOnDarkBorder,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  recentCardWide: { maxWidth: storybookTheme.layout.dashboardCardWideMaxWidth },
  tutorReportRow: {
    gap: 2,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.panelOnDarkBorder,
  },
  recentLabel: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.gold,
    letterSpacing: 0.3,
  },
  recentTitle: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onDark,
    marginTop: 2,
  },
  recentMeta: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.linkOnDark },
  recentLink: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.gold,
    marginTop: 6,
  },
});
