import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, AppNavShell, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { dashboardNavItems, fetchClass, useAuth, type ClassResponse } from '@/entities/auth';
import { listStories, type StoryCatalogEntry } from '@/entities/story';
import { formatReportDuration } from '@/pages/one-story';
import { listStoryCompletions, type StoryCompletionSummary } from '@/entities/story-completion';

type RecentLoad =
  | { status: 'loading' }
  | { status: 'ready'; completion: StoryCompletionSummary | null; title: string | null }
  | { status: 'error' };

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
 * CLASS_ACCOUNT의 실제 홈("/class") - ParentHomePage와 같은 스토리북 팔레트로 맞췄다(둘 다
 * HomePage("/")의 뒤를 잇는 화면이라 톤이 갑자기 바뀌면 안 됨). 반 코드 카드는 이 화면만의
 * 고유한 목적이라 그대로 두고, "최근에 함께 읽은 이야기"만 ParentHomePage와 같은 방식으로
 * 실제 완주 기록에서 더했다.
 */
export function ClassDashboardPage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 640;
  const [classGroup, setClassGroup] = useState<ClassResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentLoad>({ status: 'loading' });

  const classId = state.status === 'authenticated' ? state.user.classId : null;
  const token = state.status === 'authenticated' ? state.token : null;

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'CLASS_ACCOUNT') {
      navigate('/', { replace: true });
      return;
    }
    if (!token || !classId) return;
    fetchClass(token, classId)
      .then(setClassGroup)
      .catch((failure) =>
        setError(messageForError(failure, '반 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')),
      );
  }, [state, token, classId, navigate]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    Promise.all([listStoryCompletions(token), listStories()])
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
        setRecent({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const recentReady = recent.status === 'ready' ? recent : null;
  const completion = recentReady?.completion ?? null;

  if (state.status !== 'authenticated') return null;

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, 'home')}>
      <View style={styles.scroll}>
        <View style={[styles.card, isWide && styles.cardWide]}>
          <Text style={styles.eyebrow}>{timeOfDayGreeting()}</Text>
          <Text style={styles.title} accessibilityRole="header">{classGroup?.name ?? '우리 반'}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {classGroup ? (
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>반 코드</Text>
              <Text style={styles.code}>{classGroup.joinCode}</Text>
              <Text style={styles.codeBody}>학부모님께 이 코드를 알려주세요.</Text>
            </View>
          ) : null}
          <View style={styles.cta}>
            <ActionButton label="오늘 이야기 시작하기" onPress={() => navigate('/demo')} />
          </View>
        </View>

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
    justifyContent: 'center',
    alignItems: 'stretch',
    gap: 16,
    paddingHorizontal: storybookTheme.spacing.ml,
    paddingTop: storybookTheme.spacing.lg,
    paddingBottom: storybookTheme.spacing.xl,
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
  error: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.error, marginTop: 2 },
  codeBox: {
    gap: 4,
    marginTop: 10,
    padding: 18,
    borderRadius: 18,
    backgroundColor: storybookTheme.color.pillBackground,
    alignItems: 'center',
  },
  codeLabel: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardMuted,
  },
  code: {
    fontSize: storybookTheme.type.xl,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onCardTitle,
    letterSpacing: 2,
  },
  codeBody: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onCardBody, textAlign: 'center' },
  cta: { alignSelf: 'stretch', gap: 8, marginTop: 14 },
  pressed: { opacity: 0.9 },
  recentCard: {
    width: '100%',
    maxWidth: storybookTheme.layout.dashboardCardMaxWidth,
    alignSelf: 'center',
    gap: 4,
    backgroundColor: storybookTheme.color.contentPanel,
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentPanelBorder,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  recentCardWide: { maxWidth: storybookTheme.layout.dashboardCardWideMaxWidth },
  recentLabel: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.gold,
    letterSpacing: 0.3,
  },
  recentTitle: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onContent,
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
