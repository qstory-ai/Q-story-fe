import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, AppNavShell, Card, ErrorState, Icon, LoadingState, Pill, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { NotificationBell } from '@/features/notification-center';
import { dashboardNavItems, useAuth } from '@/entities/auth';
import { listTutorStudents, type TutorStudent } from '@/entities/tutor';
import { listLessons, type Lesson } from '@/entities/lesson';
import { MonthCalendar } from '@/features/month-calendar';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; students: TutorStudent[]; lessons: Lesson[] }
  | { status: 'error'; message: string };

/**
 * 선생님 홈("/tutor") - IA "[1] 홈" 섹션을 반영. 예전엔 "오늘의 수업"(주 반복 요일 기반) +
 * "이번 주 일정 요약"(요일별 카운트) 두 패널로 이번 주만 봤는데, 사용자 요청으로 한 달짜리
 * 애플식 캘린더로 교체했다 - 특정 일자를 탭하면 그 아래에 그 날의 수업 목록이 뜬다.
 * 데이터 소스도 recurring TutorSchedule에서 실 스케줄이 붙는 Lesson으로 바꿨다
 * (Lesson.scheduledAt이 실제 datetime).
 *
 *   1. 상단 바 - 브랜드 라벨 + 알림 벨.
 *   2. 인사말 카드.
 *   3. 캘린더 - 월 그리드, 일자별 dot, 선택된 일자의 수업 목록.
 *   4. CTA - 새 학생 등록 / 학생 관리 / 수업 관리 (홈에서 원터치 진입점을 늘림).
 *   5. 부모 연결 대기 학생 - 아직 부모 초대가 수락되지 않은 학생 목록.
 */
export function TutorHomePage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
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
    // 상태 필터 없이 전부 - 캘린더는 SCHEDULED만 아니라 IN_PROGRESS/COMPLETED도 dot으로
    // 표시해 지난 수업 참조가 되게 한다.
    Promise.all([listTutorStudents(state.token), listLessons(state.token)])
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
  }, [state, reloadKey]);

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

  if (state.status !== 'authenticated') return null;

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, 'home')}>
      <View style={styles.scroll}>
        <TopBar token={state.token} />

        <Card variant="surface" padding="lg" style={styles.greetingCard}>
          <Text style={styles.eyebrow}>선생님</Text>
          <Text style={styles.title} accessibilityRole="header">{state.user.displayName}님</Text>
          <Text style={styles.body}>오늘 만날 아이와 수업을 준비해 보세요.</Text>
        </Card>

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
                  onPress={() => navigate(`/tutor/lessons/${item.lesson.id}`)}
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

        {/* 튜터의 주 액션(새 학생/학생 관리/수업 관리)을 캘린더 바로 아래에 모아 두어 원터치
            진입이 가능하게 한다 - 예전엔 학생 목록으로 가려면 두 번 이동해야 했다. */}
        <View style={styles.ctaRow}>
          <ActionButton label="새 학생 등록" onPress={() => navigate('/tutor/students/new')} />
          <View style={styles.linkRow}>
            <Pressable
              accessibilityRole="link"
              onPress={() => navigate('/tutor/students')}
              style={({ pressed }) => [styles.linkChip, pressed && styles.pressed]}
            >
              <Text style={styles.linkLabel}>학생 관리 →</Text>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              onPress={() => navigate('/tutor/classes')}
              style={({ pressed }) => [styles.linkChip, pressed && styles.pressed]}
            >
              <Text style={styles.linkLabel}>수업 관리 →</Text>
            </Pressable>
          </View>
        </View>

        <Card variant="panel" padding="md" title="부모 연결 대기" style={styles.panel}>
          {load.status === 'loading' ? (
            <LoadingState compact label="학생 목록을 불러오는 중이에요…" />
          ) : pendingStudents.length === 0 ? (
            <Text style={styles.panelBody}>모든 아이와 부모 연결이 완료됐어요.</Text>
          ) : (
            pendingStudents.map((student) => (
              <View key={student.id} style={styles.studentRow}>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{student.name} · {student.ageBand}</Text>
                  {student.classType ? <Text style={styles.studentMeta}>{student.classType}</Text> : null}
                </View>
                <Pill label="부모 연결 대기" tone="onLight" />
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
      <View style={styles.brandRow}>
        <View style={styles.brandLogoFrame}>
          <Image
            source={{ uri: '/brand/q-story-question-book-logo.svg' }}
            resizeMode="contain"
            style={styles.brandLogo}
            accessibilityLabel="Q-Story 로고"
          />
        </View>
        <Text style={styles.brandWordmark}>
          <Text style={styles.brandWordmarkQ}>Q</Text>-STORY
        </Text>
      </View>
      <NotificationBell token={token} />
    </View>
  );
}

function StatusPill({ status }: { status: Lesson['status'] }) {
  if (status === 'IN_PROGRESS') return <Text style={styles.statusInProgress}>진행 중</Text>;
  if (status === 'COMPLETED') return <Text style={styles.statusCompleted}>완료</Text>;
  return null;
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit' }).format(date);
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
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandLogoFrame: {
    width: 40,
    height: 40,
    borderRadius: storybookTheme.radius.logoFrame,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: storybookTheme.color.brandFrameBackground,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
  },
  brandLogo: { width: 30, height: 32 },
  brandWordmark: {
    color: storybookTheme.color.onContent,
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    letterSpacing: 1.8,
  },
  brandWordmarkQ: { color: storybookTheme.color.gold },
  pressed: { opacity: 0.85 },
  greetingCard: {
    alignItems: 'stretch',
    gap: storybookTheme.spacing.xs,
  },
  eyebrow: {
    // 리테마 이후 error(주황빨강)은 라벨 강조에 어울리지 않아 primary(네이비)로 교체 -
    // 인사 카드의 "선생님" 라벨이 계정 톤과 어울리게.
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.primary,
    letterSpacing: 0.4,
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
    color: storybookTheme.color.gold,
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
  ctaRow: { gap: storybookTheme.spacing.sm },
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
