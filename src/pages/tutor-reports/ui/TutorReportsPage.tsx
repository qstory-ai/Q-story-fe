import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { AppNavShell, EmptyState, ErrorState, LoadingState, Pill, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { dashboardNavItems, useAuth } from '@/entities/auth';
import { listStories } from '@/entities/story';
import { formatReportDuration } from '@/pages/one-story';
import {
  listTutorStudents,
  listTutorStudentCompletions,
  type TutorStudent,
} from '@/entities/tutor';
import type { StoryCompletionSummary } from '@/entities/story-completion';

type StudentsLoad =
  | { status: 'loading' }
  | { status: 'ready'; students: TutorStudent[] }
  | { status: 'error'; message: string };

type StudentSessions = {
  student: TutorStudent;
  loading: boolean;
  completions: StoryCompletionSummary[];
  error?: string;
};

/**
 * IA 선생님 "[4] 리포트" 화면. 학생 하나당 카드 하나를 두고, 그 안에서 세션 목록을 최신순으로
 * 나열한다. 세션 카드 탭 → 기존 ReportHistoryDetailPage("/reports/:completionId")로 이동해
 * 부모용 리포트와 같은 시각화를 재사용한다(BE의 getStoryCompletion이 TUTOR도 이미 허용).
 *
 * <p>"부모에게 리포트 전송"은 IA의 명시적 액션처럼 보이지만, 현재 BE는 튜터가 완주 세션을
 * 저장하면 linkedParentUser에게 자동으로 노출되도록 이미 설계돼 있어(listParentTutorReports)
 * 별도 전송 버튼이 없다. 학생별로 부모 연결 상태 뱃지로 그 사실을 대신 보여 준다 -
 * "부모 연결됨"이면 자동 전달됨, "연결 대기"면 부모가 초대를 수락하기 전이라 아직 안 보임.
 */
export function TutorReportsPage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [studentsLoad, setStudentsLoad] = useState<StudentsLoad>({ status: 'loading' });
  const [sessionsByStudent, setSessionsByStudent] = useState<Record<string, StudentSessions>>({});
  const [titleByStoryId, setTitleByStoryId] = useState<Record<string, string>>({});
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'TUTOR') {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  useEffect(() => {
    if (state.status !== 'authenticated') return;
    let cancelled = false;
    Promise.all([listTutorStudents(state.token), listStories().catch(() => [])])
      .then(([students, stories]) => {
        if (cancelled) return;
        setStudentsLoad({ status: 'ready', students });
        setTitleByStoryId(Object.fromEntries(stories.map((story) => [story.storyId, story.title])));
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        setStudentsLoad({
          status: 'error',
          message: messageForError(failure, '학생 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [state, reloadKey]);

  // 학생별 세션 목록은 학생 목록 확정 후 병렬로 페치 - 한 학생의 실패가 다른 학생을 막지 않게
  // 각 카드가 자기 로딩/에러 상태를 갖는다. 초기 loading 표시는 아래 orderedSections에서
  // "없으면 loading으로 채우는" 파생 로직으로 처리하므로 여기서는 setState를 부르지 않는다.
  useEffect(() => {
    if (state.status !== 'authenticated') return;
    if (studentsLoad.status !== 'ready') return;
    let cancelled = false;
    for (const student of studentsLoad.students) {
      listTutorStudentCompletions(state.token, student.id)
        .then((completions) => {
          if (cancelled) return;
          setSessionsByStudent((prev) => ({
            ...prev,
            [student.id]: { student, loading: false, completions },
          }));
        })
        .catch((failure: unknown) => {
          if (cancelled) return;
          const message = messageForError(failure, '이 학생의 세션을 불러오지 못했어요.');
          setSessionsByStudent((prev) => ({
            ...prev,
            [student.id]: { student, loading: false, completions: [], error: message },
          }));
        });
    }
    return () => {
      cancelled = true;
    };
  }, [state, studentsLoad]);

  const orderedSections = useMemo(() => {
    if (studentsLoad.status !== 'ready') return [] as StudentSessions[];
    return studentsLoad.students.map(
      (student) => sessionsByStudent[student.id] ?? { student, loading: true, completions: [] },
    );
  }, [studentsLoad, sessionsByStudent]);

  if (state.status !== 'authenticated') return null;

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, 'reports')} onBack={() => navigate('/tutor')}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">수업 리포트</Text>
        <Text style={styles.subtitle}>
          학생 별로 완주한 세션을 확인할 수 있어요. 부모 연결이 완료된 학생은 부모 앱에 자동으로 전달돼요.
        </Text>

        {studentsLoad.status === 'loading' && <LoadingState label="학생 목록을 불러오는 중이에요…" />}

        {studentsLoad.status === 'error' && (
          <ErrorState message={studentsLoad.message} onRetry={() => setReloadKey((n) => n + 1)} />
        )}

        {studentsLoad.status === 'ready' && studentsLoad.students.length === 0 && (
          <EmptyState
            title="등록된 학생이 아직 없어요"
            body="학생을 먼저 등록하고 세션을 진행해 보세요."
            cta={{ label: '새 학생 등록', onPress: () => navigate('/tutor/students/new') }}
          />
        )}

        {orderedSections.map((section) => (
          <StudentSection
            key={section.student.id}
            section={section}
            titleByStoryId={titleByStoryId}
            onOpen={(completionId) => navigate(`/reports/${completionId}`)}
          />
        ))}
      </View>
    </AppNavShell>
  );
}

/* -------------------------------------------------------------- inner */

function StudentSection({
  section,
  titleByStoryId,
  onOpen,
}: {
  section: StudentSessions;
  titleByStoryId: Record<string, string>;
  onOpen: (completionId: string) => void;
}) {
  const isLinked = section.student.status === 'CONFIRMED' && section.student.linkedParentUserId;
  return (
    <View style={styles.studentCard}>
      <View style={styles.studentHeader}>
        <View style={styles.studentInfo}>
          <Text style={styles.studentName}>{section.student.name}</Text>
          <Text style={styles.studentMeta}>
            {section.student.ageBand}
            {section.student.classType ? ` · ${section.student.classType}` : ''}
          </Text>
        </View>
        <Pill label={isLinked ? '부모 연결됨 · 자동 전달' : '부모 연결 대기'} tone="onCard" />
      </View>

      {section.loading ? (
        <Text style={styles.loadingText}>세션을 불러오는 중이에요…</Text>
      ) : section.error ? (
        <Text style={styles.errorInline}>{section.error}</Text>
      ) : section.completions.length === 0 ? (
        <Text style={styles.emptyInline}>아직 이 학생과의 완주 세션이 없어요.</Text>
      ) : (
        <View style={styles.sessionList}>
          {section.completions.map((completion) => (
            <Pressable
              key={completion.id}
              accessibilityRole="button"
              accessibilityLabel={`${titleByStoryId[completion.storyId] ?? completion.storyId} 리포트 열기`}
              onPress={() => onOpen(completion.id)}
              style={({ pressed }) => [styles.sessionRow, pressed && styles.sessionRowPressed]}
            >
              <View style={styles.sessionBody}>
                <Text style={styles.sessionTitle}>
                  {titleByStoryId[completion.storyId] ?? completion.storyId}
                </Text>
                <Text style={styles.sessionMeta}>
                  {formatCompletedAt(completion.completedAt)} · {formatReportDuration(completion.durationSeconds)}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function formatCompletedAt(iso: string) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    width: '100%',
    maxWidth: storybookTheme.layout.tabletMaxWidth,
    alignSelf: 'center',
    gap: storybookTheme.spacing.md,
    paddingHorizontal: storybookTheme.spacing.ml,
    paddingTop: storybookTheme.spacing.lg,
    paddingBottom: storybookTheme.spacing.xl,
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
  studentCard: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.contentSurface,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentSurfaceBorder,
    padding: 18,
    gap: 12,
    ...storybookTheme.elevation.low,
  },
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  studentInfo: { flex: 1, gap: 2 },
  studentName: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  studentMeta: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onCardMuted,
  },
  loadingText: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onCardMuted },
  errorInline: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.error },
  emptyInline: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onCardMuted },
  sessionList: { gap: 6 },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.pillBorder,
  },
  sessionRowPressed: { opacity: 0.85 },
  sessionBody: { flex: 1, gap: 2 },
  sessionTitle: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  sessionMeta: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onCardMuted,
  },
  chevron: {
    fontSize: storybookTheme.type.lg,
    color: storybookTheme.color.onCardMuted,
    paddingHorizontal: 4,
  },
});
