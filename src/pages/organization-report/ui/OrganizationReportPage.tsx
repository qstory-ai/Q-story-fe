import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigate, useLocation } from 'react-router-dom';

import { AppNavShell, Card, ErrorState, LoadingState, Pill, radius, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { ORGANIZATION_PATHS, dashboardNavItems, reportDetailPath, useDirectorSession } from '@/entities/auth';
import { getOrganizationReport, type OrganizationReport } from '@/entities/organization-report';
import { getOrganizationUsage, type OrganizationUsage, type OrganizationUsageRecentActivity } from '@/entities/organization-usage';
import { listStories, type StoryCatalogEntry } from '@/entities/story';
import { HomeListRow, HomeSection } from '@/features/home-section';

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
    <AppNavShell tone="warm" items={dashboardNavItems(director.user, navigate, pathname)} onBack={() => navigate('/organization')}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">리포트</Text>
          <Text style={styles.subtitle}>기관 이용 현황과 반별 활동을 한눈에 보고, 수업 기록은 눌러서 개별 리포트로 확인해요.</Text>
        </View>
        {load.status === 'loading' ? <LoadingState label="리포트를 불러오는 중이에요." /> : null}
        {load.status === 'error' ? <ErrorState message={load.message} onRetry={() => setReloadKey((value) => value + 1)} /> : null}
        {load.status === 'ready' ? (
          <>
            {/* 기관 전체 지표 - 보호자 홈 인사 카드와 같은 옅은 보라 요약 카드 한 장. 좁은 화면에서는 2열로 감긴다. */}
            <Card variant="tinted" style={styles.summaryCard}>
              <View style={styles.metricGrid}>
                <Metric label="완료한 이야기" value={load.report.completionCount} />
                <Metric label="기록된 질문" value={load.report.questionCount} />
                <Metric label="반" value={load.usage.classCount} />
                <Metric label="선생님" value={load.usage.tutorCount} />
                <Metric label="학생" value={load.usage.studentCount} />
                <Metric label="연결된 보호자" value={load.usage.parentCount} />
              </View>
            </Card>

            <HomeSection title="반별 활동" layout="list">
              {load.report.classes.length === 0 ? <Text style={styles.emptyText}>아직 만든 반이 없어요.</Text> : load.report.classes.map((classGroup) => (
                <HomeListRow
                  key={classGroup.classId}
                  icon="graduationCap"
                  label={classGroup.className}
                  meta={`학생 ${classGroup.studentCount}명 · 최근 활동 ${classGroup.lastActivityAt ? formatDate(classGroup.lastActivityAt) : '없음'}`}
                  trailing={
                    <View style={styles.trailing}>
                      {classGroup.archived ? <Pill label="지난 반" tone="onLight" /> : null}
                      <Text style={styles.rowValue}>{classGroup.completionCount}회 · 질문 {classGroup.questionCount}</Text>
                    </View>
                  }
                  accessibilityLabel={`${classGroup.className} 반 상세 열기`}
                  onPress={() => navigate(ORGANIZATION_PATHS.classDetail(classGroup.classId))}
                />
              ))}
            </HomeSection>

            <HomeSection title="최근 활동" layout="list">
              {load.usage.recentActivity.length === 0 ? <Text style={styles.emptyText}>아직 활동이 없어요.</Text> : load.usage.recentActivity.map((activity) => (
                <RecentActivityRow
                  key={activity.completionId}
                  activity={activity}
                  title={load.titleByStoryId[activity.storyId] ?? activity.storyId}
                  onOpen={() => navigate(reportDetailPath(activity.completionId))}
                />
              ))}
            </HomeSection>

            <HomeSection title="가장 많이 읽은 작품" layout="list">
              {load.report.topStories.length === 0 ? <Text style={styles.emptyText}>아직 완료된 이야기가 없어요.</Text> : load.report.topStories.map((story) => (
                <HomeListRow
                  key={story.storyId}
                  icon="book"
                  label={load.titleByStoryId[story.storyId] ?? story.storyId}
                  trailing={<Text style={styles.rowValue}>{story.completionCount}회</Text>}
                />
              ))}
            </HomeSection>
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
  return (
    <HomeListRow
      icon="report"
      label={title}
      meta={`${activity.className ? `${activity.className} · ` : ''}${activity.actorDisplayName} · ${formatDateTime(activity.completedAt)}`}
      accessibilityLabel={openable ? `${title} 리포트 열기` : undefined}
      onPress={openable ? onOpen : undefined}
    />
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
  content: {
    width: '100%',
    // 보호자 하위 화면(LibraryPage/ReportHistoryPage)과 같은 폭.
    maxWidth: storybookTheme.layout.dashboardCardWideMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: storybookTheme.spacing.ml,
    paddingTop: storybookTheme.spacing.lg,
    paddingBottom: storybookTheme.spacing.xl,
    gap: 20,
  },
  header: { gap: 4 },
  title: { fontSize: storybookTheme.type.xl, fontWeight: storybookTheme.type.weight.black, color: storybookTheme.color.onContent },
  subtitle: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onContentMuted },
  summaryCard: { borderRadius: radius[24] },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },
  // 3열(넓은 화면) → 2열(minWidth에 걸리는 좁은 화면)로 감기는 지표 칸. 카드 안 카드가 되지 않게 테두리 없이 숫자만.
  metric: { flexBasis: '33%', flexGrow: 1, minWidth: 120, gap: 4 },
  metricLabel: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onCardMuted },
  metricValue: { fontSize: storybookTheme.type.xxl, fontWeight: storybookTheme.type.weight.black, color: storybookTheme.color.onCardTitle },
  emptyText: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onContentMuted, paddingHorizontal: 4 },
  // 지난 반 배지와 횟수를 세로로 쌓아 좁은 화면에서도 반 이름·보조 문구 자리를 남긴다.
  trailing: { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  rowValue: { fontSize: storybookTheme.type.xs, fontWeight: storybookTheme.type.weight.bold, color: storybookTheme.color.onCardBody },
  footnote: { fontSize: storybookTheme.type.xs, lineHeight: 18, color: storybookTheme.color.onContentMuted },
});
