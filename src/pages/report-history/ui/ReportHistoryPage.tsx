import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { AppNavShell, EmptyState, ErrorState, LoadingState, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, homePathFor, useAuth } from '@/entities/auth';
import { findChildAvatar, useChildren } from '@/entities/child';
import { listStories } from '@/entities/story';
import { messageForError } from '@/shared/api';
import { formatReportDuration } from '@/pages/one-story';
import {
  buildComprehensiveReport,
  buildRecentApproachTrend,
  type ComprehensiveReport,
  type RecentApproachTrend,
} from '@/entities/analytics';
import {
  listRecentStoryCompletions,
  listStoryCompletions,
  type StoryCompletionDetail,
  type StoryCompletionSummary,
} from '@/entities/story-completion';
import { listParentTutorReports, type TutorReportSummary } from '@/entities/tutor';

/** 종합 리포트에 넘길 최근 회차 수 - listRecentStoryCompletions()가 outcomes를 함께 실어 오는 유일한 경로. */
const COMPREHENSIVE_LIMIT = 20;
/** 트렌드 카드가 내려다보는 최근 회차 수 - 1~2회로는 "반복"이라 부르기 애매해 최소 2회 겹쳐야 표시한다. */
const RECENT_TREND_LIMIT = 5;

type Tab = 'comprehensive' | 'by-story' | 'class';

type LoadState =
  | { status: 'loading' }
  | {
      status: 'ready';
      completions: StoryCompletionSummary[];
      titleByStoryId: Record<string, string>;
      recentTrend: RecentApproachTrend | null;
      comprehensive: ComprehensiveReport;
      comprehensiveSessionCount: number;
      tutorReports: TutorReportSummary[];
    }
  | { status: 'error'; message: string };

function formatCompletedAt(iso: string) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

/**
 * IA "[3] 리포트 > 개인 리포트" 화면. 상단 탭 두 개(종합 / 작품별)로 갈리는데:
 *  - 종합: buildComprehensiveReport()의 네 축(질문 · 관심 · 생각 · 변화)을 카드로 렌더.
 *  - 작품별: 기존 완주 기록 목록 그대로.
 *
 * <p>연결된 선생님이 보낸 수업 리포트가 하나 이상이면 세 번째 "수업 리포트" 탭이 나타난다.
 * 가정에서 직접 읽은 기록(종합/작품별)과 수업에서 진행한 기록을 섞지 않는 IA 원칙을 따른다.
 */
export function ReportHistoryPage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const { children } = useChildren();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [tab, setTab] = useState<Tab>('comprehensive');
  // null = "전체 아이" 필터. children이 하나뿐일 땐 UI에서도 그 아이가 자동 선택된 것처럼 취급.
  const [childFilterId, setChildFilterId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

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
    const filters = childFilterId ? { childId: childFilterId } : undefined;
    Promise.all([
      listStoryCompletions(state.token, filters),
      listStories(),
      // 종합/트렌드 카드는 부가 기능이므로, 이 두 호출이 실패해도(예: 구버전 백엔드) 목록 자체는
      // 계속 동작해야 한다 - 실패를 빈 배열로 흡수해 각각 조용히 null/empty가 되게 한다.
      listRecentStoryCompletions(state.token, COMPREHENSIVE_LIMIT, filters).catch(
        () => [] as StoryCompletionDetail[],
      ),
      // 선생님 수업 리포트는 개별 연결의 부가 데이터다. 구버전 서버에 아직 없거나 일시적으로
      // 실패해도 가정 리포트 전체가 막히지 않도록 빈 목록으로 다룬다.
      listParentTutorReports(state.token).catch(() => [] as TutorReportSummary[]),
    ])
      .then(([completions, stories, recentDetailed, tutorReports]) => {
        if (cancelled) return;
        setLoad({
          status: 'ready',
          completions,
          titleByStoryId: Object.fromEntries(stories.map((story) => [story.storyId, story.title])),
          recentTrend:
            recentDetailed.length >= 2
              ? buildRecentApproachTrend(recentDetailed.slice(0, RECENT_TREND_LIMIT))
              : null,
          comprehensive: buildComprehensiveReport(recentDetailed),
          comprehensiveSessionCount: recentDetailed.length,
          tutorReports,
        });
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        setLoad({
          status: 'error',
          message: messageForError(failure, '리포트 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [state, childFilterId, reloadKey]);

  const emptyMessageForTab = useMemo(() => {
    if (tab === 'comprehensive') {
      return '아직 종합 리포트에 담을 완주 기록이 없어요. 이야기를 두세 편 마치면 요약이 채워져요.';
    }
    return '아직 마친 이야기가 없어요. 이야기를 끝까지 읽으면 여기에 기록이 남아요.';
  }, [tab]);

  if (!canView) return null;

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, 'reports')} onBack={() => navigate('/mypage')}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">리포트</Text>
        <Text style={styles.subtitle}>아이의 요즘 흐름을 종합해 보고, 개별 이야기 기록도 다시 볼 수 있어요.</Text>

        {children.length > 0 ? (
          <View style={styles.childFilterRow}>
            <ChildFilterChip
              label="전체 아이"
              selected={childFilterId === null}
              onPress={() => setChildFilterId(null)}
            />
            {children.map((child) => (
              <ChildFilterChip
                key={child.id}
                label={`${findChildAvatar(child.avatarKey).emoji} ${child.name}`}
                selected={childFilterId === child.id}
                onPress={() => setChildFilterId(child.id)}
              />
            ))}
          </View>
        ) : null}

        {childFilterId ? (
          <Text style={styles.filterNote}>
            선택된 아이로 진행한 기록만 표시 중이에요. 아이 프로필이 지정되지 않은 이전 기록은 &lsquo;전체 아이&rsquo;에서 볼 수 있어요.
          </Text>
        ) : null}

        <View style={styles.tabRow} accessibilityRole="tablist">
          <TabButton label="종합 리포트" active={tab === 'comprehensive'} onPress={() => setTab('comprehensive')} />
          <TabButton label="작품별 리포트" active={tab === 'by-story'} onPress={() => setTab('by-story')} />
          {load.status === 'ready' && load.tutorReports.length > 0 ? (
            <TabButton label="수업 리포트" active={tab === 'class'} onPress={() => setTab('class')} />
          ) : null}
        </View>

        {load.status === 'loading' && <LoadingState label="리포트를 불러오는 중이에요…" />}

        {load.status === 'error' && (
          <ErrorState message={load.message} onRetry={() => setReloadKey((n) => n + 1)} />
        )}

        {load.status === 'ready' && tab === 'comprehensive' && (
          <ComprehensiveView
            report={load.comprehensive}
            sessionCount={load.comprehensiveSessionCount}
            recentTrend={load.recentTrend}
            emptyMessage={emptyMessageForTab}
            onGoHome={() => navigate(state.status === 'authenticated' ? homePathFor(state.user) : '/')}
          />
        )}

        {load.status === 'ready' && tab === 'by-story' && (
          <>
            {load.completions.length === 0 ? (
              <EmptyState
                title="작품별 리포트가 아직 없어요"
                body={emptyMessageForTab}
                cta={{ label: '홈으로', onPress: () => navigate(state.status === 'authenticated' ? homePathFor(state.user) : '/') }}
              />
            ) : (
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
              ))
            )}
          </>
        )}

        {load.status === 'ready' && tab === 'class' && (
          <TutorReportView
            reports={load.tutorReports}
            titleByStoryId={load.titleByStoryId}
            onOpen={(reportId) => navigate(`/reports/${reportId}`)}
          />
        )}
      </View>
    </AppNavShell>
  );
}

function TutorReportView({
  reports,
  titleByStoryId,
  onOpen,
}: {
  reports: TutorReportSummary[];
  titleByStoryId: Record<string, string>;
  onOpen: (reportId: string) => void;
}) {
  if (reports.length === 0) {
    return (
      <EmptyState
        title="도착한 수업 리포트가 없어요"
        body="연결된 선생님과 이야기를 마치면 여기에 수업 기록이 도착해요."
      />
    );
  }

  return (
    <>
      <Text style={styles.classReportNote}>
        선생님과 진행한 수업 기록이에요. 집에서 직접 읽은 기록은 작품별 리포트에서 확인할 수 있어요.
      </Text>
      {reports.map((report) => (
        <Pressable
          key={report.id}
          onPress={() => onOpen(report.id)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.reportCard, pressed && styles.reportCardPressed]}
        >
          <Text style={styles.reportCardTitle}>{titleByStoryId[report.storyId] ?? report.storyId}</Text>
          <Text style={styles.classReportTeacher}>{report.tutorDisplayName} 선생님 · {report.studentName}</Text>
          <Text style={styles.reportCardMeta}>
            {formatCompletedAt(report.completedAt)} · {formatReportDuration(report.durationSeconds)}
          </Text>
        </Pressable>
      ))}
    </>
  );
}

/* -------------------------------------------------------------- comprehensive */

function ComprehensiveView({
  report,
  sessionCount,
  recentTrend,
  emptyMessage,
  onGoHome,
}: {
  report: ComprehensiveReport;
  sessionCount: number;
  recentTrend: RecentApproachTrend | null;
  emptyMessage: string;
  onGoHome: () => void;
}) {
  if (sessionCount === 0) {
    return (
      <EmptyState
        title="종합 리포트가 아직 없어요"
        body={emptyMessage}
        cta={{ label: '홈으로', onPress: onGoHome }}
      />
    );
  }

  return (
    <>
      <QuestionCard report={report} sessionCount={sessionCount} />
      <InterestCard report={report} />
      <ThoughtCard report={report} recentTrend={recentTrend} />
      <GrowthCard report={report} />
    </>
  );
}

function QuestionCard({ report, sessionCount }: { report: ComprehensiveReport; sessionCount: number }) {
  const q = report.question;
  return (
    <View style={styles.reportCard}>
      <Text style={styles.sectionEyebrow}>질문 분석</Text>
      <Text style={styles.sectionTitle}>
        최근 {sessionCount}편에서 {q.totalQuestions}번 질문했어요.
      </Text>
      <Text style={styles.sectionBody}>
        한 편당 평균 {q.averagePerSession}번의 질문을 했어요.
      </Text>
      {q.byType.length > 0 ? (
        <View style={styles.miniList}>
          {q.byType.slice(0, 4).map((row) => (
            <MiniRow key={row.label} label={row.label} count={row.count} />
          ))}
        </View>
      ) : (
        <Text style={styles.sectionMuted}>
          아직 질문을 만들지 않고 이야기를 감상만 한 편이 대부분이에요.
        </Text>
      )}
    </View>
  );
}

function InterestCard({ report }: { report: ComprehensiveReport }) {
  const i = report.interest;
  return (
    <View style={styles.reportCard}>
      <Text style={styles.sectionEyebrow}>관심 분석</Text>
      <Text style={styles.sectionTitle}>아이가 자주 표현한 궁금증</Text>
      {i.topExpressions.length > 0 ? (
        <View style={styles.miniList}>
          {i.topExpressions.map((entry) => (
            <MiniRow key={entry.text} label={`‘${entry.text}’`} count={entry.count} />
          ))}
        </View>
      ) : i.recentExpressions.length > 0 ? (
        <>
          <Text style={styles.sectionBody}>
            아직 반복되는 표현은 없지만, 최근에 이런 궁금증을 남겼어요.
          </Text>
          <View style={styles.miniList}>
            {i.recentExpressions.slice(0, 3).map((text, index) => (
              <Text key={`${text}-${index}`} style={styles.quoteItem}>· ‘{text}’</Text>
            ))}
          </View>
        </>
      ) : (
        <Text style={styles.sectionMuted}>
          아직 아이가 표현한 궁금증이 쌓이지 않았어요.
        </Text>
      )}
    </View>
  );
}

function ThoughtCard({
  report,
  recentTrend,
}: {
  report: ComprehensiveReport;
  recentTrend: RecentApproachTrend | null;
}) {
  const t = report.thought;
  return (
    <View style={styles.reportCard}>
      <Text style={styles.sectionEyebrow}>생각 분석</Text>
      {recentTrend?.repeatedApproach ? (
        <>
          <Text style={styles.sectionTitle}>
            요즘 자주 쓰는 접근: ‘{recentTrend.repeatedApproach.label}’
          </Text>
          <Text style={styles.sectionBody}>
            최근 {recentTrend.sessionCount}편에서 이 방법을 {recentTrend.repeatedApproach.count}번
            골랐어요. 성격이나 발달을 판단하는 진단은 아니고 최근 흐름이에요.
          </Text>
        </>
      ) : (
        <Text style={styles.sectionTitle}>
          여러 방식으로 이야기에 다가서고 있어요.
        </Text>
      )}
      {t.strategies.length > 0 ? (
        <View style={styles.miniList}>
          {t.strategies.slice(0, 4).map((row) => (
            <MiniRow key={row.label} label={row.label} count={row.count} />
          ))}
        </View>
      ) : (
        <Text style={styles.sectionMuted}>
          이번 기록에는 특정 전략이 반복해서 나타나지 않았어요.
        </Text>
      )}
    </View>
  );
}

function GrowthCard({ report }: { report: ComprehensiveReport }) {
  const g = report.growth;
  return (
    <View style={styles.reportCard}>
      <Text style={styles.sectionEyebrow}>변화·성장 기록</Text>
      {!g ? (
        <Text style={styles.sectionMuted}>
          아직 변화 흐름을 보여주기엔 이야기가 부족해요. 네 편 이상 마치면 여기에서 흐름이 보여요.
        </Text>
      ) : g.broadening === true ? (
        <>
          <Text style={styles.sectionTitle}>
            요즘 접근이 다양해지고 있어요.
          </Text>
          <Text style={styles.sectionBody}>
            앞의 {g.early.sessionCount}편은 {g.early.diversity}가지 접근이었고, 최근{' '}
            {g.recent.sessionCount}편은 {g.recent.diversity}가지로 넓어졌어요.
          </Text>
        </>
      ) : g.broadening === false ? (
        <>
          <Text style={styles.sectionTitle}>
            요즘은 한두 가지 방법에 집중하고 있어요.
          </Text>
          <Text style={styles.sectionBody}>
            앞의 {g.early.sessionCount}편은 {g.early.diversity}가지 접근이었고, 최근{' '}
            {g.recent.sessionCount}편은 {g.recent.diversity}가지로 좁혀졌어요.
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.sectionTitle}>
            앞과 최근의 접근 다양성이 비슷하게 유지되고 있어요.
          </Text>
          <Text style={styles.sectionBody}>
            앞의 {g.early.sessionCount}편과 최근 {g.recent.sessionCount}편 모두 {g.recent.diversity}가지
            정도의 방법을 오갔어요.
          </Text>
        </>
      )}
    </View>
  );
}

function MiniRow({ label, count }: { label: string; count: number }) {
  return (
    <View style={styles.miniRow}>
      <Text style={styles.miniRowLabel} numberOfLines={2}>{label}</Text>
      <Text style={styles.miniRowCount}>{count}회</Text>
    </View>
  );
}

/* -------------------------------------------------------------- tabs UI */

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && styles.tabPressed]}
    >
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function ChildFilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.childFilterChip,
        selected && styles.childFilterChipActive,
        pressed && styles.tabPressed,
      ]}
    >
      <Text style={[styles.childFilterLabel, selected && styles.childFilterLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    width: '100%',
    // contentMaxWidth(420)는 로그인/가입 같은 단일 폼 페이지 폭 - 이 탭의 형제인
    // ParentHomePage/ClassDashboardPage는 진작에 dashboardCardWideMaxWidth(760)로 옮겨가서,
    // 이 페이지만 420에 남아 같은 사이드바 레이아웃 안에서 유독 좁고 여백이 크게 떠 있었다.
    maxWidth: storybookTheme.layout.dashboardCardWideMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: storybookTheme.spacing.ml,
    paddingTop: storybookTheme.spacing.lg,
    paddingBottom: storybookTheme.spacing.xl,
    gap: 14,
  },
  title: {
    fontSize: storybookTheme.type.xl,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onContent,
  },
  subtitle: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.onContentMuted,
  },
  tabRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  childFilterRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  childFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: storybookTheme.radius.pill,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentPanelBorder,
  },
  childFilterChipActive: {
    backgroundColor: storybookTheme.color.contentPanel,
    borderColor: storybookTheme.color.gold,
  },
  childFilterLabel: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.semibold,
    color: storybookTheme.color.onContentMuted,
  },
  childFilterLabelActive: { color: storybookTheme.color.gold },
  filterNote: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onContentMuted,
    marginTop: -6,
  },
  classReportNote: {
    fontSize: storybookTheme.type.xs,
    lineHeight: storybookTheme.type.xs * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onContentMuted,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: storybookTheme.radius.pill,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentPanelBorder,
  },
  tabActive: { backgroundColor: storybookTheme.color.gold, borderColor: storybookTheme.color.gold },
  tabPressed: { opacity: 0.85 },
  tabLabel: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onContentMuted,
  },
  tabLabelActive: { color: storybookTheme.color.background },
  reportCard: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    padding: 18,
    gap: 8,
    ...storybookTheme.elevation.low,
  },
  reportCardPressed: { opacity: 0.9 },
  reportCardTitle: {
    fontSize: storybookTheme.type.md,
    lineHeight: storybookTheme.type.md * storybookTheme.lineHeight.normal,
    fontWeight: storybookTheme.type.weight.semibold,
    color: storybookTheme.color.onCardTitle,
  },
  reportCardMeta: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onCardMuted,
  },
  classReportTeacher: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.semibold,
    color: storybookTheme.color.onCardBody,
  },
  sectionEyebrow: {
    fontSize: storybookTheme.type.xxs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.gold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: storybookTheme.type.md,
    lineHeight: storybookTheme.type.md * storybookTheme.lineHeight.normal,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  sectionBody: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onCardBody,
  },
  sectionMuted: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.onCardMuted,
  },
  miniList: { marginTop: 4, gap: 6 },
  miniRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.pillBorder,
    gap: 10,
  },
  miniRowLabel: {
    flex: 1,
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.onCardBody,
  },
  miniRowCount: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.gold,
  },
  quoteItem: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onCardBody,
  },
});
