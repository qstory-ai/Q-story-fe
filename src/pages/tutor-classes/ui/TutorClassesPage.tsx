import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, AppNavShell, EmptyState, ErrorState, FilterChip, Icon, LoadingState, Pill, storybookTheme } from '@/shared/ui';
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
 * 학생 뷰는 /tutor/students가 맡고, 이 화면은 "수업" 축만 다룬다.
 */
export function TutorClassesPage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [tab, setTab] = useState<Tab>('SCHEDULED');
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [formOpen, setFormOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
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
    // 이전 데이터는 그대로 두고 응답 도착 시 갈아 낀다(setState-in-effect 규칙 회피).
    listLessons(token, { status: tab as LessonStatus })
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
  }, [token, tab, reloadKey]);

  const refresh = useCallback(() => setReloadKey((n) => n + 1), []);

  if (state.status !== 'authenticated') return null;

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, 'classes')} onBack={() => navigate('/tutor')}>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title} accessibilityRole="header">수업</Text>
          <ActionButton label="새 수업 만들기" icon="+" size="sm" onPress={() => setFormOpen(true)} />
        </View>

        <View style={styles.tabRow} accessibilityRole="tablist">
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
              <LessonRow
                key={lesson.id}
                lesson={lesson}
                onPress={() => navigate(`/tutor/lessons/${lesson.id}`)}
                onEdit={lesson.status === 'SCHEDULED' ? () => setEditingLesson(lesson) : undefined}
              />
            ))}
          </View>
        )}

        <ActionButton
          variant="secondaryFull"
          label="학생 관리로 이동"
          onPress={() => navigate('/tutor/students')}
        />
      </View>

      {/* key로 open/closed(+ 편집 대상)를 걸어 열 때마다 폼을 초기값으로 remount한다. */}
      <LessonFormModal
        key={editingLesson ? `edit:${editingLesson.id}:${editingLesson.updatedAt}` : formOpen ? 'open' : 'closed'}
        visible={formOpen || editingLesson != null}
        editing={editingLesson}
        onClose={() => {
          setFormOpen(false);
          setEditingLesson(null);
        }}
        onCreated={refresh}
        onSaved={() => {
          refresh();
          setEditingLesson(null);
        }}
      />
    </AppNavShell>
  );
}

/* -------------------------------------------------------------- inner */

/**
 * onEdit은 카드 Pressable과 형제인 트레일링 버튼으로 둔다 - 웹 DOM에서 Pressable을 중첩하면
 * 클릭이 둘 다에 전달돼 편집을 누르면 상세로도 이동해 버린다.
 */
function LessonRow({
  lesson,
  onPress,
  onEdit,
}: {
  lesson: Lesson;
  onPress: () => void;
  onEdit?: () => void;
}) {
  return (
    <View style={[styles.row, onEdit ? styles.rowWithEdit : null]}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${lesson.name} 수업 상세 열기`}
        onPress={onPress}
        style={({ pressed }) => [styles.rowAction, pressed && styles.rowPressed]}
      >
        <View style={styles.rowLead}>
          <Text style={styles.rowLeadDay} numberOfLines={1}>{lesson.scheduledAt ? formatShortDate(lesson.scheduledAt) : '일정 미정'}</Text>
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
      {onEdit ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${lesson.name} 수업 편집`}
          onPress={onEdit}
          style={({ pressed }) => [styles.rowEditButton, pressed && styles.rowEditButtonPressed]}
        >
          <Icon name="pencil" size={16} color={storybookTheme.color.onContentMuted} />
        </Pressable>
      ) : null}
    </View>
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

const SHORT_DATE_FORMAT = new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' });
const SHORT_TIME_FORMAT = new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit' });

function formatShortDate(iso: string) {
  return SHORT_DATE_FORMAT.format(new Date(iso));
}

function formatShortTime(iso: string) {
  return SHORT_TIME_FORMAT.format(new Date(iso));
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
    alignItems: 'stretch',
    backgroundColor: storybookTheme.color.contentPanel,
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentPanelBorder,
  },
  rowWithEdit: { paddingRight: 4 },
  rowAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  rowPressed: { opacity: 0.9 },
  rowEditButton: {
    alignSelf: 'center',
    padding: 10,
    borderRadius: storybookTheme.radius.card,
  },
  rowEditButtonPressed: { backgroundColor: storybookTheme.color.contentPanelBorder },
  // "12월 25일"까지 한 줄에 들어가는 폭 - 60일 땐 두 자리 일자에서 "10월 / 8일"로 줄이 갈렸다.
  rowLead: {
    width: 76,
    gap: 2,
    paddingRight: 8,
    borderRightWidth: 1,
    borderRightColor: storybookTheme.color.contentPanelBorder,
  },
  rowLeadDay: {
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
