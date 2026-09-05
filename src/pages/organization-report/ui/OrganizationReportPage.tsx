import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { AppNavShell, ErrorState, LoadingState, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { dashboardNavItems, useAuth } from '@/entities/auth';
import { getOrganizationReport, type OrganizationReport } from '@/entities/organization-report';
import { listStories, type StoryCatalogEntry } from '@/entities/story';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; report: OrganizationReport; titleByStoryId: Record<string, string> }
  | { status: 'error'; message: string };

export function OrganizationReportPage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const organizationId = state.status === 'authenticated' ? state.user.organizationId : null;
  const canView = state.status === 'authenticated' && state.user.role === 'DIRECTOR' && Boolean(organizationId);

  useEffect(() => {
    if (state.status !== 'loading' && !canView) navigate('/', { replace: true });
  }, [state.status, canView, navigate]);

  useEffect(() => {
    if (state.status !== 'authenticated' || !organizationId) return;
    let cancelled = false;
    Promise.all([getOrganizationReport(state.token, organizationId), listStories().catch(() => [] as StoryCatalogEntry[])])
      .then(([report, stories]) => {
        if (!cancelled) {
          setLoad({ status: 'ready', report, titleByStoryId: Object.fromEntries(stories.map((story) => [story.storyId, story.title])) });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoad({ status: 'error', message: messageForError(error, '기관 리포트를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.') });
      });
    return () => { cancelled = true; };
  }, [state, organizationId, reloadKey]);

  if (!canView) return null;

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, 'home')} onBack={() => navigate('/organization')}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">기관 리포트</Text>
        <Text style={styles.subtitle}>반별 활동과 질문 수를 집계해 수업 운영 흐름을 확인해요.</Text>
        {load.status === 'loading' ? <LoadingState label="기관 리포트를 불러오는 중이에요." /> : null}
        {load.status === 'error' ? <ErrorState message={load.message} onRetry={() => setReloadKey((value) => value + 1)} /> : null}
        {load.status === 'ready' ? (
          <>
            <View style={styles.metricGrid}>
              <Metric label="완료한 이야기" value={load.report.completionCount} />
              <Metric label="기록된 질문" value={load.report.questionCount} />
              <Metric label="운영 중인 반" value={load.report.classes.length} />
            </View>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>반별 활동</Text>
              {load.report.classes.length === 0 ? <Text style={styles.body}>아직 만든 반이 없어요.</Text> : load.report.classes.map((classGroup) => (
                <View key={classGroup.classId} style={styles.row}>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle}>{classGroup.className}</Text>
                    <Text style={styles.rowMeta}>보호자 {classGroup.parentCount}명 · 최근 활동 {classGroup.lastActivityAt ? formatDate(classGroup.lastActivityAt) : '없음'}</Text>
                  </View>
                  <Text style={styles.rowValue}>{classGroup.completionCount}회 · 질문 {classGroup.questionCount}</Text>
                </View>
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
            <Text style={styles.footnote}>개별 아이의 질문 내용은 표시하지 않고 기관·반 단위로만 집계합니다.</Text>
          </>
        ) : null}
      </View>
    </AppNavShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value.toLocaleString('ko-KR')}</Text></View>;
}

function formatDate(value: string) {
  // 다른 마이페이지/구독 화면의 formatDate와 달리 year를 빼먹고 있었다 - "최근 활동"은 반이
  // 오래 쉬면 작년 이전 날짜도 나오는데, 연도 없이 "3월 12일"만 보이면 올해 건지 헷갈린다.
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value));
}

const styles = StyleSheet.create({
  content: { flex: 1, width: '100%', maxWidth: storybookTheme.layout.contentMaxWidth, alignSelf: 'center', paddingHorizontal: storybookTheme.spacing.ml, paddingVertical: storybookTheme.spacing.lg, gap: storybookTheme.spacing.md },
  title: { fontSize: storybookTheme.type.xl, fontWeight: storybookTheme.type.weight.black, color: storybookTheme.color.onContent },
  subtitle: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onContentMuted },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { flexGrow: 1, minWidth: 130, padding: 16, gap: 4, borderRadius: storybookTheme.radius.card, backgroundColor: storybookTheme.color.surfaceCard, borderWidth: 1, borderColor: storybookTheme.color.surfaceCardBorder },
  metricLabel: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onCardMuted },
  metricValue: { fontSize: storybookTheme.type.xxl, fontWeight: storybookTheme.type.weight.black, color: storybookTheme.color.onCardTitle },
  card: { padding: storybookTheme.spacing.ml, gap: 8, borderRadius: storybookTheme.radius.card, backgroundColor: storybookTheme.color.surfaceCard, borderWidth: 1, borderColor: storybookTheme.color.surfaceCardBorder },
  sectionTitle: { fontSize: storybookTheme.type.md, fontWeight: storybookTheme.type.weight.bold, color: storybookTheme.color.onCardTitle },
  body: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onCardBody },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: storybookTheme.color.pillBorder },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { flex: 1, fontSize: storybookTheme.type.sm, fontWeight: storybookTheme.type.weight.bold, color: storybookTheme.color.onCardTitle },
  rowMeta: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onCardMuted },
  rowValue: { fontSize: storybookTheme.type.xs, fontWeight: storybookTheme.type.weight.bold, color: storybookTheme.color.onCardBody },
  footnote: { fontSize: storybookTheme.type.xs, lineHeight: 18, color: storybookTheme.color.onContentMuted },
});
