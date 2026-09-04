import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, AppNavShell, Card, Icon, Pill, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { NotificationBell } from '@/features/notification-center';
import { dashboardNavItems, useAuth } from '@/entities/auth';
import {
  listTutorSchedules,
  listTutorStudents,
  type TutorSchedule,
  type TutorStudent,
} from '@/entities/tutor';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; students: TutorStudent[]; schedules: TutorSchedule[] }
  | { status: 'error'; message: string };

const WEEKDAY_LABEL: Record<TutorSchedule['weekday'], string> = {
  MON: '월', TUE: '화', WED: '수', THU: '목', FRI: '금', SAT: '토',
};

const WEEKDAY_ORDER: TutorSchedule['weekday'][] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/**
 * 선생님 홈("/tutor") - IA "[1] 홈" 섹션을 반영해 다음 순서로 재구성했다:
 *
 *   1. 상단 바 - 브랜드 라벨 + 알림 벨(스텁).
 *   2. 인사말 카드 - 예전 CTA는 하단으로 밀어서 오늘의 수업이 상단에 오도록.
 *   3. 오늘의 수업 - listTutorSchedules()를 오늘 요일 + startTime 순으로 필터.
 *   4. 진행 중인 수업 - 아직 세션 진행 상태 추적이 없어서 "부모 연결 대기중"인 학생만
 *      노출해 최소한 노는 카드는 아니게 한다(추후 세션 진행 상태 스키마가 생기면 대체).
 *   5. 최근 활동 - 이번 세션에선 데이터가 부족해 안내 카피만.
 *   6. CTA - 새 학생/주간 일정 링크.
 */
export function TutorHomePage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'TUTOR') {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  useEffect(() => {
    if (state.status !== 'authenticated') return;
    let cancelled = false;
    Promise.all([listTutorStudents(state.token), listTutorSchedules(state.token)])
      .then(([students, schedules]) => {
        if (!cancelled) setLoad({ status: 'ready', students, schedules });
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
  }, [state]);

  const todaysWeekday = useMemo(() => weekdayFromDate(new Date()), []);
  const todaysClasses = useMemo(() => {
    if (load.status !== 'ready') return [] as TutorSchedule[];
    return load.schedules
      .filter((schedule) => schedule.weekday === todaysWeekday)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [load, todaysWeekday]);

  const pendingStudents = useMemo(() => {
    if (load.status !== 'ready') return [] as TutorStudent[];
    return load.students
      .filter((student) => student.status === 'PENDING_PARENT')
      .slice(0, 4);
  }, [load]);

  const upcomingByWeekday = useMemo(() => {
    if (load.status !== 'ready') return {} as Record<TutorSchedule['weekday'], number>;
    const map: Record<string, number> = {};
    for (const schedule of load.schedules) map[schedule.weekday] = (map[schedule.weekday] ?? 0) + 1;
    return map as Record<TutorSchedule['weekday'], number>;
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

        <Card
          variant="panel"
          padding="md"
          title={`오늘의 수업 · ${weekdayLabelToday(todaysWeekday)}요일`}
          style={styles.panel}
        >
          {load.status === 'loading' ? (
            <Text style={styles.panelBody}>불러오는 중이에요…</Text>
          ) : todaysClasses.length === 0 ? (
            <Text style={styles.panelBody}>오늘 예정된 수업이 없어요.</Text>
          ) : (
            todaysClasses.map((schedule) => (
              <Pressable
                key={schedule.id}
                accessibilityRole="link"
                onPress={() => navigate('/tutor/schedule')}
                style={({ pressed }) => [styles.scheduleRow, pressed && styles.pressed]}
              >
                <View style={styles.timeCol}>
                  <Text style={styles.timeText}>{formatTime(schedule.startTime)}</Text>
                  <Text style={styles.timeMeta}>{formatDuration(schedule.startTime, schedule.endTime)}</Text>
                </View>
                <View style={styles.scheduleBody}>
                  <Text style={styles.scheduleName}>{schedule.studentName}</Text>
                  <Text style={styles.scheduleMeta} numberOfLines={1}>{schedule.location}</Text>
                </View>
                <Icon name="chevronRight" size={16} color={storybookTheme.color.onDarkMuted} />
              </Pressable>
            ))
          )}
        </Card>

        {/* 튜터의 주 액션(새 학생 등록)을 부수 정보(진행 중/주간 요약)보다 위로 올린다 -
            예전엔 CTA가 맨 아래에 있어 스크롤이 필요했다. */}
        <View style={styles.ctaRow}>
          <ActionButton label="새 학생 등록" onPress={() => navigate('/tutor/students/new')} />
          <Pressable
            accessibilityRole="link"
            onPress={() => navigate('/tutor/classes')}
            style={({ pressed }) => [styles.linkChip, pressed && styles.pressed]}
          >
            <Text style={styles.linkLabel}>수업 관리 열기 →</Text>
          </Pressable>
        </View>

        <Card variant="panel" padding="md" title="이번 주 진행 중" style={styles.panel}>
          {load.status === 'loading' ? (
            <Text style={styles.panelBody}>불러오는 중이에요…</Text>
          ) : pendingStudents.length === 0 ? (
            <Text style={styles.panelBody}>모든 아이와 부모 연결이 완료됐어요.</Text>
          ) : (
            pendingStudents.map((student) => (
              <View key={student.id} style={styles.studentRow}>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{student.name} · {student.ageBand}</Text>
                  {student.classType ? <Text style={styles.studentMeta}>{student.classType}</Text> : null}
                </View>
                <Pill label="부모 연결 대기" tone="onDark" />
              </View>
            ))
          )}
        </Card>

        <Card variant="panel" padding="md" title="이번 주 일정 요약" style={styles.panel}>
          <View style={styles.weeklyRow}>
            {WEEKDAY_ORDER.map((weekday) => {
              const count = upcomingByWeekday[weekday] ?? 0;
              const isToday = weekday === todaysWeekday;
              return (
                <View
                  key={weekday}
                  style={[
                    styles.weeklyPill,
                    isToday && styles.weeklyPillToday,
                  ]}
                >
                  <Text style={[styles.weeklyLabel, isToday && styles.weeklyLabelToday]}>
                    {WEEKDAY_LABEL[weekday]}
                  </Text>
                  <Text style={[styles.weeklyCount, isToday && styles.weeklyLabelToday]}>{count}</Text>
                </View>
              );
            })}
          </View>
        </Card>

        {load.status === 'error' ? <Text style={styles.errorText}>{load.message}</Text> : null}
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

function weekdayFromDate(date: Date): TutorSchedule['weekday'] {
  // getDay(): 0=Sun … 6=Sat. 이 앱은 일요일 수업을 지원하지 않아 SUN은 MON으로 폴백한다.
  const map: Record<number, TutorSchedule['weekday']> = {
    0: 'MON', 1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU', 5: 'FRI', 6: 'SAT',
  };
  return map[date.getDay()];
}

function weekdayLabelToday(weekday: TutorSchedule['weekday']) {
  return WEEKDAY_LABEL[weekday];
}

function formatTime(time: string) {
  // "HH:MM:SS" 또는 "HH:MM" 형태를 그대로 HH:MM만 보여준다.
  return time.slice(0, 5);
}

function formatDuration(startTime: string, endTime: string) {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const minutes = (eh * 60 + em) - (sh * 60 + sm);
  if (!Number.isFinite(minutes) || minutes <= 0) return '';
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`;
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
    color: storybookTheme.color.onDark,
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    letterSpacing: 1.8,
  },
  brandWordmarkQ: { color: storybookTheme.color.gold },
  pressed: { opacity: 0.85 },
  // Card 프리미티브가 배경/테두리/라운드/패딩을 담당한다. 여기선 인사 카드 안의 자식 gap만 오버라이드.
  greetingCard: {
    alignItems: 'stretch',
    gap: storybookTheme.spacing.xs,
  },
  eyebrow: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.error,
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
  // Card variant='panel'이 배경/테두리/라운드/패딩을 담당. 여기선 자식 gap만 오버라이드.
  panel: {
    gap: storybookTheme.spacing.ms,
  },
  panelBody: { fontSize: storybookTheme.type.sm, lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal, color: storybookTheme.color.onDarkMuted },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: storybookTheme.spacing.ms,
    paddingVertical: storybookTheme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.panelOnDarkBorder,
  },
  timeCol: { width: 72, gap: 2 },
  timeText: { fontSize: storybookTheme.type.md, fontWeight: storybookTheme.type.weight.bold, color: storybookTheme.color.onDark },
  timeMeta: { fontSize: storybookTheme.type.xxs, color: storybookTheme.color.onDarkMuted },
  scheduleBody: { flex: 1, gap: 2 },
  scheduleName: { fontSize: storybookTheme.type.sm, fontWeight: storybookTheme.type.weight.bold, color: storybookTheme.color.onDark },
  scheduleMeta: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onDarkMuted },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: storybookTheme.spacing.sm,
    paddingVertical: storybookTheme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.panelOnDarkBorder,
  },
  studentInfo: { gap: 2 },
  studentName: { fontSize: storybookTheme.type.sm, fontWeight: storybookTheme.type.weight.bold, color: storybookTheme.color.onDark },
  studentMeta: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onDarkMuted },
  weeklyRow: { flexDirection: 'row', gap: storybookTheme.spacing.xs, justifyContent: 'space-between' },
  weeklyPill: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: storybookTheme.spacing.sm,
    borderRadius: storybookTheme.radius.input,
    backgroundColor: storybookTheme.color.panelOnDarkBackground,
    borderWidth: 1,
    borderColor: storybookTheme.color.panelOnDarkBorder,
  },
  weeklyPillToday: {
    // 골드 강조 배경 - "오늘"만 이 톤을 쓴다. 다른 곳에도 쓰면 그때 토큰화한다.
    backgroundColor: 'rgba(246, 198, 77, 0.15)',
    borderColor: storybookTheme.color.gold,
  },
  weeklyLabel: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.semibold,
    color: storybookTheme.color.onDarkMuted,
  },
  weeklyLabelToday: { color: storybookTheme.color.gold },
  weeklyCount: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onDark,
  },
  ctaRow: { gap: 8 },
  linkChip: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  linkLabel: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.primary,
  },
  errorText: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.error, textAlign: 'center' },
});
