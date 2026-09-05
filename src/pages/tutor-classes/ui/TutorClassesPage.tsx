import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, AppNavShell, EmptyState, ErrorState, FilterChip, LoadingState, Pill, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { dashboardNavItems, useAuth } from '@/entities/auth';
import { listLessons, type Lesson, type LessonStatus } from '@/entities/lesson';
import { LessonFormModal } from '@/features/lesson-form';

type Tab = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';

const TABS: { key: Tab; label: string }[] = [
  { key: 'SCHEDULED', label: '예정된 수업' },
  { key: 'IN_PROGRESS', label: '진행 중' },
  { key: 'COMPLETED', label: '완료' },
];

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; lessons: Lesson[] }
  | { status: 'error'; message: string };

/**
 * IA "[3] 수업" 화면. 상단 서브탭 세 개(예정/진행/완료)로 lesson.status를 필터하고, 각 카드
 * 탭 → /tutor/lessons/{id} 상세 페이지로 이동. '새 수업 만들기'는 LessonFormModal.
 *
 * <p>지난 세션의 뼈대(학생 상태 기반 근사치)를 실데이터(lesson)로 교체했다. 학생 뷰는 여전히
 * /tutor/students로 접근하고, 이 화면은 "수업" 축만 다룬다.
 */
export function TutorClassesPage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [tab, setTab] = useState<Tab>('SCHEDULED');
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [formOpen, setFormOpen] = useState(false);
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
    // tab이나 reloadKey가 바뀌면 새 요청을 시작 - 이전 데이터는 그대로 두고, 응답 도착 시 갈아
    // 낀다. 매 이펙트에서 즉시 setState({loading})으로 초기화하는 방식은 setState-in-effect
    // 규칙에 걸려서, 대신 요청 응답 자체가 이전 상태를 덮어쓰도록 흘려 보낸다.
    listLessons(state.token, { status: tab as LessonStatus })
      .then((lessons) => {
        if (!cancelled) setLoad({ status: 'ready', lessons });
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        const message = messageForError(failure, '수업 목록을 불러오지 못했어요.');
        setLoad({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [state, tab, reloadKey]);

  const refresh = useCallback(() => setReloadKey((n) => n + 1), []);

  if (state.status !== 'authenticated') return null;

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, 'classes')} onBack={() => navigate('/tutor')}>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title} accessibilityRole="header">수업</Text>
          <ActionButton label="새 수업 만들기" onPress={() => setFormOpen(true)} />
        </View>

        <View style={styles.tabRow}>
          {TABS.map((entry) => (
            <FilterChip
              key={entry.key}
              accessibilityRole="tab"
              tone="filled"
              label={entry.label}
              selected={entry.key === tab}
              onPress={() => setTab(entry.key)}
            />
          ))}
        </View>

        {load.status === 'loading' ? (
          <LoadingState label="수업을 불러오는 중이에요…" />
        ) : load.status === 'error' ? (
          <ErrorState message={load.message} onRetry={refresh} />
        ) : load.lessons.length === 0 ? (
          <EmptyForTab tab={tab} onNewLesson={() => setFormOpen(true)} />
        ) : (
          <View style={styles.list}>
            {load.lessons.map((lesson) => (
              <LessonRow key={lesson.id} lesson={lesson} onPress={() => navigate(`/tutor/lessons/${lesson.id}`)} />
            ))}
          </View>
        )}

        <ActionButton
          variant="secondaryFull"
          label="학생 관리로 이동"
          onPress={() => navigate('/tutor/students')}
        />
      </View>

      {/* key로 open/closed 상태를 걸어 매번 열 때 폼이 초기화되도록 한다 - LessonFormModal이
          이제 lazy useState로 초기값을 잡아, 다시 열면 이전 입력이 남지 않고 빈 폼이 보인다. */}
      <LessonFormModal
        key={formOpen ? 'open' : 'closed'}
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={() => refresh()}
      />
    </AppNavShell>
  );
}

/* -------------------------------------------------------------- inner */

function LessonRow({ lesson, onPress }: { lesson: Lesson; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${lesson.name} 수업 상세 열기`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowLead}>
        <Text style={styles.rowLeadDay}>{lesson.scheduledAt ? formatShortDate(lesson.scheduledAt) : '일정 미정'}</Text>
        {lesson.scheduledAt ? (
          <Text style={styles.rowLeadTime}>{formatShortTime(lesson.scheduledAt)}</Text>
        ) : null}
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{lesson.name}</Text>
        {lesson.goal ? <Text style={styles.rowGoal} numberOfLines={2}>{lesson.goal}</Text> : null}
        <View style={styles.rowMetaRow}>
          <Pill label={`학생 ${lesson.students.length}명`} tone="onCard" />
          <Pill label={`이야기 ${lesson.storyIds.length}편`} tone="onCard" />
        </View>
      </View>
    </Pressable>
  );
}

function EmptyForTab({ tab, onNewLesson }: { tab: Tab; onNewLesson: () => void }) {
  // 각 탭별 empty title + body + CTA를 명시. SCHEDULED만 새 수업 만들기 유도 -
  // IN_PROGRESS/COMPLETED는 시스템 상태이지 유도할 액션이 아니다.
  const props =
    tab === 'SCHEDULED'
      ? {
          title: '예정된 수업이 없어요',
          body: '새 수업을 만들어 시작해 보세요.',
          cta: { label: '새 수업 만들기', onPress: onNewLesson },
        }
      : tab === 'IN_PROGRESS'
        ? { title: '진행 중인 수업이 없어요', body: '예정된 수업을 시작하면 여기에 표시돼요.' }
        : { title: '완료된 수업이 없어요', body: '수업을 마치면 여기에 기록이 남아요.' };
  return <EmptyState {...props} />;
}

function formatShortDate(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(new Date(iso));
}

function formatShortTime(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
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
    color: storybookTheme.color.onContent,
  },
  tabRow: { flexDirection: 'row', gap: storybookTheme.spacing.sm, flexWrap: 'wrap' },
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: storybookTheme.color.contentPanel,
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentPanelBorder,
  },
  rowPressed: { opacity: 0.9 },
  rowLead: {
    width: 60,
    gap: 2,
    paddingRight: 8,
    borderRightWidth: 1,
    borderRightColor: storybookTheme.color.contentPanelBorder,
  },
  rowLeadDay: {
    // 리테마 이후 라이트 배경 위 gold는 워시된 것처럼 대비 낮아 primary로 교체 - 날짜 라벨은
    // 각 수업 행의 primary anchor. 계정/브랜드 톤과도 일관.
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.primary,
  },
  rowLeadTime: {
    fontSize: storybookTheme.type.xxs,
    color: storybookTheme.color.onContentMuted,
  },
  rowBody: { flex: 1, gap: 4 },
  rowTitle: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onContent,
  },
  rowGoal: {
    fontSize: storybookTheme.type.xs,
    lineHeight: storybookTheme.type.xs * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onContentMuted,
  },
  rowMetaRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 },
});
