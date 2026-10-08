import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { AppNavShell, ErrorState, LoadingState, Pill, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { useBackOr } from '@/shared/lib';
import {
  ORGANIZATION_PATHS,
  dashboardNavItems,
  fetchClass,
  listClassStudentReports,
  listClassStudents,
  reportDetailPath,
  useDirectorSession,
  type ClassStudentReport,
  type ClassStudentResponse,
} from '@/entities/auth';
import { listStories, type StoryCatalogEntry } from '@/entities/story';
import { formatReportDuration } from '@/pages/one-story';
import { StudentReportList, sessionKindLabel } from '@/features/student-reports';
import { ClassHistoryCard } from '@/features/class-lifecycle';
import { pastMemberLabel } from '@/entities/class-lifecycle';

type LoadState =
  | { requestKey: string; status: 'loading' }
  | {
      requestKey: string;
      status: 'ready';
      className: string;
      student: ClassStudentResponse;
      reports: ClassStudentReport[];
      titleByStoryId: Record<string, string>;
    }
  | { requestKey: string; status: 'error'; message: string };

/**
 * 관리자의 학생 상세(/organization/classes/:classId/students/:studentId) - 보호자 연결 상태와 이 학생이 참여한
 * 수업 리포트. 담임이 바뀐 반이면 지난 담임의 기록도 함께 보이고, 줄마다 진행한 선생님 이름이 붙는다.
 * 반을 옮기거나 수료한 학생도 지난 반에서 열 수 있다(includePast) - 반 이력과 모든 반의 리포트(줄마다 그때 반 이름)를 보여 준다.
 */
export function OrganizationStudentDetailPage() {
  const { classId, studentId } = useParams<{ classId: string; studentId: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const director = useDirectorSession(navigate);
  const goBack = useBackOr(classId ? ORGANIZATION_PATHS.classDetail(classId) : ORGANIZATION_PATHS.classes);
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${classId ?? ''}:${studentId ?? ''}:${attempt}`;
  const [load, setLoad] = useState<LoadState>({ requestKey, status: 'loading' });
  const token = director?.token ?? null;

  useEffect(() => {
    if (!token || !classId || !studentId) return;
    let cancelled = false;
    Promise.all([
      fetchClass(token, classId),
      listClassStudents(token, classId, { includePast: true }),
      listClassStudentReports(token, classId, studentId),
      listStories().catch(() => [] as StoryCatalogEntry[]),
    ])
      .then(([classGroup, students, reports, stories]) => {
        if (cancelled) return;
        const student = students.find((entry) => entry.id === studentId);
        if (!student) {
          setLoad({ requestKey, status: 'error', message: '이 반에서 학생을 찾을 수 없어요.' });
          return;
        }
        setLoad({
          requestKey,
          status: 'ready',
          className: classGroup.name,
          student,
          reports,
          titleByStoryId: Object.fromEntries(stories.map((story) => [story.storyId, story.title])),
        });
      })
      .catch((failure: unknown) => {
        if (!cancelled) {
          setLoad({ requestKey, status: 'error', message: messageForError(failure, '학생 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.') });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, classId, studentId, requestKey]);

  if (!director) return null;
  const effective: LoadState = load.requestKey === requestKey ? load : { requestKey, status: 'loading' };

  return (
    <AppNavShell items={dashboardNavItems(director.user, navigate, pathname)} onBack={goBack}>
      <ScrollView contentContainerStyle={styles.content}>
        {effective.status === 'loading' && <LoadingState label="학생 정보를 불러오는 중이에요…" />}
        {effective.status === 'error' && (
          <ErrorState message={effective.message} onRetry={() => setAttempt((n) => n + 1)} />
        )}
        {effective.status === 'ready' && (
          <>
            <View style={styles.card}>
              <View style={styles.headerRow}>
                <View style={styles.flex}>
                  <Text style={styles.eyebrow}>{effective.className}</Text>
                  <Text style={styles.title} accessibilityRole="header">{effective.student.name}</Text>
                  <Text style={styles.meta}>{effective.student.ageBand}</Text>
                </View>
                {effective.student.endedAt ? (
                  <Pill label={pastMemberLabel(effective.student)} tone="onLight" />
                ) : (
                  <Pill
                    label={effective.student.status === 'CONFIRMED' ? '연결됨' : '보호자 연결 대기'}
                    tone={effective.student.status === 'CONFIRMED' ? 'accent' : 'onCard'}
                  />
                )}
              </View>
              <Text style={styles.body}>
                {effective.student.parentDisplayName
                  ? `보호자 ${effective.student.parentDisplayName}${effective.student.parentEmail ? ` · ${effective.student.parentEmail}` : ''}`
                  : '아직 보호자가 반 초대 링크로 들어오지 않았어요.'}
              </Text>
            </View>

            <ClassHistoryCard token={director.token} studentId={effective.student.id} />

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>리포트</Text>
              <StudentReportList
                rows={effective.reports.map((report) => ({
                  id: report.id,
                  title: effective.titleByStoryId[report.storyId] ?? report.storyId,
                  meta: [
                    formatCompletedAt(report.completedAt),
                    // 그때 반 이름 - 반을 옮겼거나 이름을 바꿨어도 기록 당시 반.
                    ...(report.className ? [report.className] : []),
                    formatReportDuration(report.durationSeconds),
                    sessionKindLabel(report.sessionKind),
                    `${report.tutorDisplayName} 선생님`,
                  ].join(' · '),
                }))}
                emptyMessage="아직 이 학생이 참여한 수업 리포트가 없어요."
                onOpen={(completionId) => navigate(reportDetailPath(completionId))}
              />
            </View>
          </>
        )}
      </ScrollView>
    </AppNavShell>
  );
}

const COMPLETED_AT_FORMAT = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function formatCompletedAt(iso: string) {
  return COMPLETED_AT_FORMAT.format(new Date(iso));
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: storybookTheme.layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: storybookTheme.spacing.ml,
    paddingTop: storybookTheme.spacing.lg,
    paddingBottom: storybookTheme.spacing.xl,
    gap: storybookTheme.spacing.md,
  },
  card: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    padding: storybookTheme.spacing.ml,
    gap: storybookTheme.spacing.sm,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: storybookTheme.spacing.sm },
  flex: { flex: 1, gap: 2 },
  eyebrow: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.goldText,
  },
  title: {
    fontSize: storybookTheme.type.xl,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onCardTitle,
  },
  meta: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onCardMuted },
  body: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onCardBody,
  },
  sectionTitle: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
});
