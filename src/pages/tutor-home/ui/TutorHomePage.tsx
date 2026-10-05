import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate, useLocation } from 'react-router-dom';

import { BrandLockup, ActionButton, AppNavShell, Card, ErrorState, Icon, LoadingState, Pill, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { NotificationBell } from '@/features/notification-center';
import { TUTOR_PATHS, dashboardNavItems, useAuth } from '@/entities/auth';
import { listTutorStudents, type TutorStudent } from '@/entities/tutor';
import { listLessons, type Lesson } from '@/entities/lesson';
import { MonthCalendar } from '@/features/month-calendar';
import { teacherTitle } from '@/shared/lib';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; students: TutorStudent[]; lessons: Lesson[] }
  | { status: 'error'; message: string };

/**
 * 선생님 홈("/tutor") - IA "[1] 홈" 섹션. 캘린더는 Lesson.scheduledAt 기준 월 그리드이고,
 * 일자를 탭하면 그 날의 수업 목록이 뜬다.
 *
 *   1. 상단 바 - 브랜드 라벨 + 알림 벨.
 *   2. 인사말 카드.
 *   3. 캘린더 - 월 그리드, 일자별 dot, 선택된 일자의 수업 목록.
 *   4. 첫 방문에는 "새 반 만들기", 그 뒤로는 반·학생 / 수업 바로가기.
 *   5. 부모 연결 대기 학생 - 아직 부모님이 반 초대 링크로 연결하지 않은 학생 목록.
 */
export function TutorHomePage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { state } = useAuth();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'TUTOR') {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  const token = state.status === 'authenticated' ? state.token : null;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    // 상태 필터 없이 전부 - 캘린더는 SCHEDULED만 아니라 IN_PROGRESS/COMPLETED도 dot으로
    // 표시해 지난 수업 참조가 되게 한다.
    Promise.all([listTutorStudents(token), listLessons(token)])
      .then(([students, lessons]) => {
        if (!cancelled) setLoad({ status: 'ready', students, lessons });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = messageForError(error, '학생 정보를 불러오지 못했어요.');
          setLoad({ status: 'error', message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, reloadKey]);

  const calendarItems = useMemo(() => {
    if (load.status !== 'ready') return [] as { id: string; date: Date; lesson: Lesson }[];
    return load.lessons
      .filter((lesson) => lesson.scheduledAt !== null)
      .map((lesson) => ({
        id: lesson.id,
        date: new Date(lesson.scheduledAt as string),
        lesson,
      }));
  }, [load]);

  const pendingStudents = useMemo(() => {
    if (load.status !== 'ready') return [] as TutorStudent[];
    return load.students.filter((student) => student.status === 'PENDING_PARENT').slice(0, 4);
  }, [load]);

  // 반도 수업도 아직 없는 첫 방문 - 빈 캘린더가 한 화면을 다 차지해 "새 반 만들기"가 접힌 아래로
  // 밀려나 있었다. 이때는 시작 안내와 CTA를 캘린더 위로 올린다.
  const isFirstVisit = load.status === 'ready' && load.lessons.length === 0 && load.students.length === 0;

  if (state.status !== 'authenticated') return null;

  // 반 만들기는 반·학생 탭이 기본 진입점이다(Q-35). 홈에서는 반도 수업도 없는 첫 방문에만 시작 버튼을 보이고,
  // 그 뒤로는 탭과 같은 곳으로 가는 바로가기만 둔다.
  const firstVisitCta = (
    <ActionButton label="새 반 만들기" onPress={() => navigate(TUTOR_PATHS.newClass)} />
  );
  const shortcutRow = (
    <View style={styles.linkRow}>
      <Pressable
        accessibilityRole="link"
        onPress={() => navigate(TUTOR_PATHS.classes)}
        style={({ pressed }) => [styles.linkChip, pressed && styles.pressed]}
      >
        <Text style={styles.linkLabel}>반·학생 →</Text>
      </Pressable>
      <Pressable
        accessibilityRole="link"
        onPress={() => navigate(TUTOR_PATHS.lessons)}
        style={({ pressed }) => [styles.linkChip, pressed && styles.pressed]}
      >
        <Text style={styles.linkLabel}>수업 →</Text>
      </Pressable>
    </View>
  );

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, pathname)}>
      <View style={styles.scroll}>
        <TopBar token={state.token} />

        <Card variant="surface" padding="lg" style={styles.greetingCard}>
          <Text style={styles.title} accessibilityRole="header">{teacherTitle(state.user.displayName)}</Text>
          <Text style={styles.body}>
            {isFirstVisit
              ? '반을 만들고 초대 링크를 보호자에게 보내면 아이들이 명단에 들어와요. 1:1 과외도 아이 한 명짜리 반으로 시작해요.'
              : '오늘 만날 아이와 수업을 준비해 보세요.'}
          </Text>
        </Card>

        {isFirstVisit ? firstVisitCta : null}

        <Card variant="panel" padding="md" title="수업 캘린더" style={styles.panel}>
          {load.status === 'loading' ? (
            <LoadingState compact label="수업 일정을 불러오는 중이에요…" />
          ) : (
            <MonthCalendar
              items={calendarItems}
              emptyDayMessage="이 날에는 예정된 수업이 없어요."
              renderItem={(item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="link"
                  accessibilityLabel={`${item.lesson.name} 수업 상세 열기`}
                  onPress={() => navigate(TUTOR_PATHS.lesson(item.lesson.id))}
                  style={({ pressed }) => [styles.lessonRow, pressed && styles.pressed]}
                >
                  <View style={styles.timeCol}>
                    <Text style={styles.timeText}>{formatTime(item.date)}</Text>
                    <StatusPill status={item.lesson.status} />
                  </View>
                  <View style={styles.lessonBody}>
                    <Text style={styles.lessonName}>{item.lesson.name}</Text>
                    {item.lesson.goal ? (
                      <Text style={styles.lessonMeta} numberOfLines={1}>{item.lesson.goal}</Text>
                    ) : null}
                    <View style={styles.metaRow}>
                      <Pill label={`학생 ${item.lesson.students.length}명`} tone="onCard" />
                      <Pill label={`이야기 ${item.lesson.storyIds.length}편`} tone="onCard" />
                    </View>
                  </View>
                  <Icon name="chevronRight" size={16} color={storybookTheme.color.onContentMuted} />
                </Pressable>
              )}
            />
          )}
        </Card>

        {isFirstVisit ? null : shortcutRow}

        <Card variant="panel" padding="md" title="보호자 연결 대기" style={styles.panel}>
          {load.status === 'loading' ? (
            <LoadingState compact label="학생 목록을 불러오는 중이에요…" />
          ) : load.status === 'ready' && load.students.length === 0 ? (
            <Text style={styles.panelBody}>아직 반에 들어온 아이가 없어요. 반 초대 링크를 보내면 보호자가 아이를 연결해요.</Text>
          ) : pendingStudents.length === 0 ? (
            <Text style={styles.panelBody}>모든 아이의 보호자 연결이 끝났어요.</Text>
          ) : (
            pendingStudents.map((student) => (
              <View key={student.id} style={styles.studentRow}>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{student.name} · {student.ageBand}</Text>
                  {student.classType ? <Text style={styles.studentMeta}>{student.classType}</Text> : null}
                </View>
                <Pill label="보호자 연결 대기" tone="onLight" />
              </View>
            ))
          )}
        </Card>

        {load.status === 'error' ? (
          <ErrorState message={load.message} onRetry={() => setReloadKey((n) => n + 1)} />
        ) : null}
      </View>
    </AppNavShell>
  );
}

/* -------------------------------------------------------------------- helpers */

function TopBar({ token }: { token: string }) {
  return (
    <View style={styles.topBar}>
      <BrandLockup size="compact" tone="onLight" />
      <NotificationBell token={token} />
    </View>
  );
}

function StatusPill({ status }: { status: Lesson['status'] }) {
  if (status === 'IN_PROGRESS') return <Text style={styles.statusInProgress}>진행 중</Text>;
  if (status === 'COMPLETED') return <Text style={styles.statusCompleted}>완료</Text>;
  return null;
}

const TIME_FORMAT = new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit' });

function formatTime(date: Date) {
  return TIME_FORMAT.format(date);
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    width: '100%',
    maxWidth: storybookTheme.layout.tabletMaxWidth,
    alignSelf: 'center',
    gap: storybookTheme.spacing.md,
    paddingHorizontal: storybookTheme.spacing.ml,
    paddingTop: storybookTheme.spacing.lg,
    paddingBottom: storybookTheme.spacing.xl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pressed: { opacity: 0.85 },
  greetingCard: {
    alignItems: 'stretch',
    gap: storybookTheme.spacing.xs,
  },
  title: {
    fontSize: storybookTheme.type.lg,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onCardTitle,
  },
  body: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onCardBody,
    marginTop: 2,
  },
  panel: {
    gap: storybookTheme.spacing.ms,
  },
  panelBody: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onContentMuted,
  },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: storybookTheme.spacing.ms,
    paddingVertical: storybookTheme.spacing.sm,
    paddingHorizontal: storybookTheme.spacing.sm,
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.contentPanel,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentPanelBorder,
  },
  timeCol: { width: 68, gap: 2 },
  timeText: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onContent,
  },
  statusInProgress: {
    fontSize: storybookTheme.type.xxs,
    color: storybookTheme.color.goldText,
    fontWeight: storybookTheme.type.weight.semibold,
  },
  statusCompleted: {
    fontSize: storybookTheme.type.xxs,
    color: storybookTheme.color.onContentMuted,
    fontWeight: storybookTheme.type.weight.semibold,
  },
  lessonBody: { flex: 1, gap: 4 },
  lessonName: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onContent,
  },
  lessonMeta: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onContentMuted },
  metaRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: storybookTheme.spacing.sm,
    paddingVertical: storybookTheme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.contentPanelBorder,
  },
  studentInfo: { gap: 2 },
  studentName: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onContent,
  },
  studentMeta: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onContentMuted },
  linkRow: { flexDirection: 'row', gap: storybookTheme.spacing.sm, justifyContent: 'center', flexWrap: 'wrap' },
  linkChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  linkLabel: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.primary,
  },
});
