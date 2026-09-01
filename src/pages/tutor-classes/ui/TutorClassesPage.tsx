import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, AppNavShell, Pill, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, useAuth } from '@/entities/auth';
import {
  listTutorSchedules,
  listTutorStudents,
  type TutorSchedule,
  type TutorStudent,
} from '@/entities/tutor';

type Tab = 'upcoming' | 'in-progress' | 'done';

const TABS: { key: Tab; label: string }[] = [
  { key: 'upcoming', label: '예정된 수업' },
  { key: 'in-progress', label: '진행 중' },
  { key: 'done', label: '완료' },
];

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; students: TutorStudent[]; schedules: TutorSchedule[] }
  | { status: 'error'; message: string };

const WEEKDAY_LABEL: Record<TutorSchedule['weekday'], string> = {
  MON: '월', TUE: '화', WED: '수', THU: '목', FRI: '금', SAT: '토',
};

/**
 * 선생님 "수업" 탭("/tutor/classes") - IA에서 요구한 수업 목록(예정/진행중/완료) 세 개 서브탭을
 * 하나의 화면으로 묶었다. 기존 /tutor/students, /tutor/schedule은 딥링크 유지를 위해 그대로
 * 두되, 이 페이지가 그 두 기능을 요약해 노출한다.
 *
 * - "예정된 수업": listTutorSchedules() 전체 목록을 요일 순으로.
 * - "진행 중": 부모 연결 대기(PENDING_PARENT) 학생 목록 - 세션 진행 상태 스키마가 없어 근사치.
 * - "완료": 아직 완료 세션 목록이 없어 안내만.
 */
export function TutorClassesPage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [tab, setTab] = useState<Tab>('upcoming');
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
          const message = error instanceof Error ? error.message : '수업 정보를 불러오지 못했어요.';
          setLoad({ status: 'error', message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [state]);

  const upcoming = useMemo(() => {
    if (load.status !== 'ready') return [] as TutorSchedule[];
    return [...load.schedules].sort((a, b) => {
      const cmp = a.weekday.localeCompare(b.weekday);
      return cmp !== 0 ? cmp : a.startTime.localeCompare(b.startTime);
    });
  }, [load]);

  const pending = useMemo(() => {
    if (load.status !== 'ready') return [] as TutorStudent[];
    return load.students.filter((student) => student.status === 'PENDING_PARENT');
  }, [load]);

  if (state.status !== 'authenticated') return null;

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, 'classes')}>
      <View style={styles.scroll}>
        <View style={styles.headerRow}>
          <Text style={styles.title} accessibilityRole="header">수업</Text>
          <ActionButton label="새 학생 등록" onPress={() => navigate('/tutor/students/new')} />
        </View>

        <View style={styles.tabRow}>
          {TABS.map((entry) => {
            const active = entry.key === tab;
            return (
              <Pressable
                key={entry.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setTab(entry.key)}
                style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && styles.pressed]}
              >
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{entry.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {tab === 'upcoming' && (
          <View style={styles.list}>
            {upcoming.length === 0 ? (
              <Empty caption="등록된 정기 수업이 아직 없어요." />
            ) : (
              upcoming.map((schedule) => (
                <Pressable
                  key={schedule.id}
                  accessibilityRole="link"
                  onPress={() => navigate('/tutor/schedule')}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                >
                  <View style={styles.rowLead}>
                    <Text style={styles.rowLeadText}>{WEEKDAY_LABEL[schedule.weekday]}</Text>
                    <Text style={styles.rowLeadSub}>{schedule.startTime.slice(0, 5)}</Text>
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle}>{schedule.studentName}</Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>{schedule.location}</Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        )}

        {tab === 'in-progress' && (
          <View style={styles.list}>
            {pending.length === 0 ? (
              <Empty caption="지금 진행 중인 수업이 없어요." />
            ) : (
              pending.map((student) => (
                <View key={student.id} style={styles.row}>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle}>{student.name} · {student.ageBand}</Text>
                    {student.classType ? <Text style={styles.rowMeta}>{student.classType}</Text> : null}
                  </View>
                  <Pill label="부모 연결 대기" tone="onDark" />
                </View>
              ))
            )}
          </View>
        )}

        {tab === 'done' && (
          <Empty caption="완료된 수업이 곧 여기에 모여요." />
        )}

        {load.status === 'error' ? <Text style={styles.errorText}>{load.message}</Text> : null}
      </View>
    </AppNavShell>
  );
}

function Empty({ caption }: { caption: string }) {
  return (
    <View style={styles.emptyPanel}>
      <Text style={styles.emptyText}>{caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: storybookTheme.type.xl,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onDark,
  },
  tabRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: storybookTheme.radius.pill,
    borderWidth: 1,
    borderColor: storybookTheme.color.panelOnDarkBorder,
  },
  tabActive: { backgroundColor: storybookTheme.color.gold, borderColor: storybookTheme.color.gold },
  pressed: { opacity: 0.85 },
  tabLabel: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onDarkMuted,
  },
  tabLabelActive: { color: storybookTheme.color.background },
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: storybookTheme.color.panelOnDarkBackground,
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    borderColor: storybookTheme.color.panelOnDarkBorder,
  },
  rowLead: {
    width: 44,
    alignItems: 'center',
    gap: 2,
    paddingRight: 8,
    borderRightWidth: 1,
    borderRightColor: storybookTheme.color.panelOnDarkBorder,
  },
  rowLeadText: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.gold,
  },
  rowLeadSub: {
    fontSize: storybookTheme.type.xxs,
    color: storybookTheme.color.onDarkMuted,
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onDark,
  },
  rowMeta: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onDarkMuted,
  },
  emptyPanel: {
    backgroundColor: storybookTheme.color.panelOnDarkBackground,
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    borderColor: storybookTheme.color.panelOnDarkBorder,
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.onDarkMuted,
  },
  errorText: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.error, textAlign: 'center' },
});
