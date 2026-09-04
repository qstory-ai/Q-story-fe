import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { AppNavShell, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { dashboardNavItems, useAuth } from '@/entities/auth';
import { listStories, type StoryCatalogEntry } from '@/entities/story';
import {
  getOrganizationUsage,
  type OrganizationUsage,
} from '@/entities/organization-usage';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; usage: OrganizationUsage; titleByStoryId: Record<string, string> }
  | { status: 'error'; message: string };

/**
 * IA "기관 관리자 > 이용 현황 관리". 지표 카드 5개(선생님/반/부모/반 계정/누적 완주)와 최근
 * 활동 리스트. 최근 활동은 카탈로그와 join해 이야기 제목을 표시하되, 카탈로그 실패는 조용히
 * 흡수해 storyId 원문을 대신 노출한다.
 */
export function OrganizationUsagePage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });

  const canView = state.status === 'authenticated' && state.user.role === 'DIRECTOR' && Boolean(state.user.organizationId);
  const organizationId = state.status === 'authenticated' ? state.user.organizationId : null;

  useEffect(() => {
    if (state.status === 'loading') return;
    if (!canView) {
      navigate('/', { replace: true });
    }
  }, [state.status, canView, navigate]);

  useEffect(() => {
    if (state.status !== 'authenticated' || !organizationId) return;
    let cancelled = false;
    Promise.all([
      getOrganizationUsage(state.token, organizationId),
      listStories().catch(() => [] as StoryCatalogEntry[]),
    ])
      .then(([usage, stories]) => {
        if (cancelled) return;
        setLoad({
          status: 'ready',
          usage,
          titleByStoryId: Object.fromEntries(stories.map((story) => [story.storyId, story.title])),
        });
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        setLoad({
          status: 'error',
          message: messageForError(failure, '이용 현황을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [state, organizationId]);

  if (!canView) return null;

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, 'home')} onBack={() => navigate('/organization')}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">이용 현황</Text>
        <Text style={styles.subtitle}>기관 전체의 요약 지표와 최근 완주 활동을 확인해요.</Text>

        {load.status === 'loading' && (
          <View style={styles.centerBox}><ActivityIndicator color={storybookTheme.color.gold} /></View>
        )}

        {load.status === 'error' && (
          <View style={styles.card}>
            <Text style={styles.errorText}>{load.message}</Text>
          </View>
        )}

        {load.status === 'ready' && (
          <>
            <View style={styles.metricsGrid}>
              <MetricCard label="누적 완주" value={load.usage.completionCount} />
              <MetricCard label="선생님" value={load.usage.tutorCount} />
              <MetricCard label="반" value={load.usage.classCount} />
              <MetricCard label="부모 계정" value={load.usage.parentCount} />
              <MetricCard label="반 계정" value={load.usage.classAccountCount} />
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>최근 활동</Text>
              {load.usage.recentActivity.length === 0 ? (
                <Text style={styles.body}>아직 완주 기록이 없어요.</Text>
              ) : (
                load.usage.recentActivity.map((activity) => (
                  <View key={activity.completionId} style={styles.activityRow}>
                    <View style={styles.activityBody}>
                      <Text style={styles.activityStory}>
                        {load.titleByStoryId[activity.storyId] ?? activity.storyId}
                      </Text>
                      <Text style={styles.activityMeta}>
                        {activity.actorDisplayName} · {formatDateTime(activity.completedAt)}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </View>
    </AppNavShell>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value.toLocaleString('ko-KR')}</Text>
    </View>
  );
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(iso));
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    width: '100%',
    maxWidth: storybookTheme.layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: storybookTheme.spacing.ml,
    paddingTop: storybookTheme.spacing.lg,
    paddingBottom: storybookTheme.spacing.xl,
    gap: 14,
  },
  title: {
    fontSize: storybookTheme.type.xl,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onDark,
  },
  subtitle: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onDarkMuted },
  centerBox: { alignItems: 'center', paddingVertical: 40 },
  card: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    padding: 20,
    gap: 10,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    flexBasis: '30%',
    flexGrow: 1,
    minWidth: 140,
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    padding: 16,
    gap: 4,
  },
  metricLabel: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardMuted,
  },
  metricValue: {
    fontSize: storybookTheme.type.xxl,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onCardTitle,
  },
  sectionTitle: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  body: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onCardBody },
  errorText: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.error },
  activityRow: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.pillBorder,
  },
  activityBody: { gap: 2 },
  activityStory: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  activityMeta: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onCardMuted },
});
