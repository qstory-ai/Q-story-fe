import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigate, useLocation } from 'react-router-dom';

import { AppNavShell, ErrorState, LoadingState, Pill, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { ORGANIZATION_PATHS, dashboardNavItems, reportDetailPath, useDirectorSession } from '@/entities/auth';
import { getOrganizationReport, type OrganizationReport } from '@/entities/organization-report';
import { getOrganizationUsage, type OrganizationUsage, type OrganizationUsageRecentActivity } from '@/entities/organization-usage';
import { listStories, type StoryCatalogEntry } from '@/entities/story';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; report: OrganizationReport; usage: OrganizationUsage; titleByStoryId: Record<string, string> }
  | { status: 'error'; message: string };

/**
 * 관리자 "리포트" 탭(/organization/reports) - 예전 "이용 현황"과 "기관 리포트"를 한 화면으로 합쳤다(Q-35).
 * 기관 전체 지표 → 반별 활동(누르면 반 상세) → 최근 활동(수업 기록은 누르면 개별 리포트) → 많이 읽은 작품 순.
 */
export function OrganizationReportPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const director = useDirectorSession(navigate);
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const token = director?.token ?? null;
  const organizationId = director?.organizationId ?? null;

  useEffect(() => {
    if (!token || !organizationId) return;
    let cancelled = false;
    Promise.all([
      getOrganizationReport(token, organizationId),
      getOrganizationUsage(token, organizationId),
      listStories().catch(() => [] as StoryCatalogEntry[]),
    ])
      .then(([report, usage, stories]) => {
        if (!cancelled) {
          setLoad({
            status: 'ready',
            report,
            usage,
            titleByStoryId: Object.fromEntries(stories.map((story) => [story.storyId, story.title])),
          });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoad({ status: 'error', message: messageForError(error, '리포트를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.') });
      });
    return () => { cancelled = true; };
  }, [token, organizationId, reloadKey]);

  if (!director) return null;

  return (
    <AppNavShell items={dashboardNavItems(director.user, navigate, pathname)} onBack={() => navigate('/organization')}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} accessibilityRole="header">리포트</Text>
        <Text style={styles.subtitle}>기관 이용 현황과 반별 활동을 한눈에 보고, 수업 기록은 눌러서 개별 리포트로 확인해요.</Text>
        {load.status === 'loading' ? <LoadingState label="리포트를 불러오는 중이에요." /> : null}
        {load.status === 'error' ? <ErrorState message={load.message} onRetry={() => setReloadKey((value) => value + 1)} /> : null}
        {load.status === 'ready' ? (
          <>
            <View style={styles.metricGrid}>
              <Metric label="완료한 이야기" value={load.report.completionCount} />
              <Metric label="기록된 질문" value={load.report.questionCount} />
              <Metric label="반" value={load.usage.classCount} />
              <Metric label="선생님" value={load.usage.tutorCount} />
              <Metric label="학생" value={load.usage.studentCount} />
              <Metric label="연결된 보호자" value={load.usage.parentCount} />
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>반별 활동</Text>
              {load.report.classes.length === 0 ? <Text style={styles.body}>아직 만든 반이 없어요.</Text> : load.report.classes.map((classGroup) => (
                <Pressable
                  key={classGroup.classId}
                  accessibilityRole="link"
                  accessibilityLabel={`${classGroup.className} 반 상세 열기`}
                  onPress={() => navigate(ORGANIZATION_PATHS.classDetail(classGroup.classId))}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                >
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle}>{classGroup.className}</Text>
                    <Text style={styles.rowMeta}>학생 {classGroup.studentCount}명 · 최근 활동 {classGroup.lastActivityAt ? formatDate(classGroup.lastActivityAt) : '없음'}</Text>
                  </View>
                  {classGroup.archived ? <Pill label="지난 반" tone="onLight" /> : null}
                  <Text style={styles.rowValue}>{classGroup.completionCount}회 · 질문 {classGroup.questionCount}</Text>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>최근 활동</Text>
              {load.usage.recentActivity.length === 0 ? <Text style={styles.body}>아직 활동이 없어요.</Text> : load.usage.recentActivity.map((activity) => (
                <RecentActivityRow
                  key={activity.completionId}
                  activity={activity}
                  title={load.titleByStoryId[activity.storyId] ?? activity.storyId}
                  onOpen={() => navigate(reportDetailPath(activity.completionId))}
                />
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>가장 많이 읽은 작품</Text>
              {load.report.topStories.length === 0 ? <Text style={styles.body}>아직 완료된 이야기가 없어요.</Text> : load.report.topStories.map((story) => (
                <View key={story.storyId} style={styles.row}>
                  <Text style={styles.rowTitle}>{load.titleByStoryId[story.storyId] ?? story.storyId}</Text>
                  <Text style={styles.rowValue}>{story.completionCount}회</Text>
                </View>
              ))}
            </View>
            <Text style={styles.footnote}>
              수업 기록은 학생 상세나 최근 활동에서 개별 리포트를 열 수 있어요. 보호자가 집에서 읽은 기록은 보호자만 볼 수 있어 집계에만 들어가요.
            </Text>
          </>
        ) : null}
      </ScrollView>
    </AppNavShell>
  );
}

/** 수업 기록(반·개별 수업)만 개별 리포트로 열린다 - 가정 기록이나 구분을 모르는 예전 응답은 줄만 보여 준다. */
function RecentActivityRow({ activity, title, onOpen }: { activity: OrganizationUsageRecentActivity; title: string; onOpen: () => void }) {
  const openable = activity.sessionKind === 'CLASS' || activity.sessionKind === 'TUTOR';
  const body = (
    <View style={styles.rowMain}>
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={styles.rowMeta}>{activity.className ? `${activity.className} · ` : ''}{activity.actorDisplayName} · {formatDateTime(activity.completedAt)}</Text>
    </View>
  );
  if (!openable) return <View style={styles.row}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${title} 리포트 열기`}
      onPress={onOpen}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {body}
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value.toLocaleString('ko-KR')}</Text></View>;
}

function formatDate(value: string) {
  // "최근 활동"은 작년 날짜일 수도 있어 연도까지 보여 준다.
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value));
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: storybookTheme.layout.contentMaxWidth, alignSelf: 'center', paddingHorizontal: storybookTheme.spacing.ml, paddingVertical: storybookTheme.spacing.lg, gap: storybookTheme.spacing.md },
  title: { fontSize: storybookTheme.type.xl, fontWeight: storybookTheme.type.weight.black, color: storybookTheme.color.onContent },
  subtitle: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onContentMuted },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { flexBasis: '30%', flexGrow: 1, minWidth: 130, padding: 16, gap: 4, borderRadius: storybookTheme.radius.card, backgroundColor: storybookTheme.color.surfaceCard, borderWidth: 1, borderColor: storybookTheme.color.surfaceCardBorder },
  metricLabel: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onCardMuted },
  metricValue: { fontSize: storybookTheme.type.xxl, fontWeight: storybookTheme.type.weight.black, color: storybookTheme.color.onCardTitle },
  card: { padding: storybookTheme.spacing.ml, gap: 8, borderRadius: storybookTheme.radius.card, backgroundColor: storybookTheme.color.surfaceCard, borderWidth: 1, borderColor: storybookTheme.color.surfaceCardBorder },
  sectionTitle: { fontSize: storybookTheme.type.md, fontWeight: storybookTheme.type.weight.bold, color: storybookTheme.color.onCardTitle },
  body: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onCardBody },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: storybookTheme.color.pillBorder },
  pressed: { opacity: 0.85 },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { flex: 1, fontSize: storybookTheme.type.sm, fontWeight: storybookTheme.type.weight.bold, color: storybookTheme.color.onCardTitle },
  rowMeta: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onCardMuted },
  rowValue: { fontSize: storybookTheme.type.xs, fontWeight: storybookTheme.type.weight.bold, color: storybookTheme.color.onCardBody },
  chevron: { fontSize: storybookTheme.type.lg, color: storybookTheme.color.onCardMuted, paddingHorizontal: 4 },
  footnote: { fontSize: storybookTheme.type.xs, lineHeight: 18, color: storybookTheme.color.onContentMuted },
});
