import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate, useLocation } from 'react-router-dom';

import { ActionButton, AppNavShell, BrandLockup, Card, EmptyState, ErrorState, Icon, LoadingState, Pill, radius, semanticColors, storybookTheme, StoryCard } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { NotificationBell } from '@/features/notification-center';
import { TUTOR_PATHS, dashboardNavItems, useAuth } from '@/entities/auth';
import { listTutorStudents, type TutorStudent } from '@/entities/tutor';
import { listLessons, type Lesson } from '@/entities/lesson';
import { listStories, unlockStateFor, type StoryCatalogEntry } from '@/entities/story';
import { storyDestination } from '@/features/story-library';
import { MonthCalendar } from '@/features/month-calendar';
import { HomeGreetingCard, HomeHeroCard, HomeListRow, HomeSection, timeOfDayGreeting } from '@/features/home-section';
import { teacherTitle } from '@/shared/lib';

import { countToday, formatLessonTime as formatTime, lessonWhen, pickNextLesson } from '../model/next-lesson';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; students: TutorStudent[]; lessons: Lesson[] }
  | { status: 'error'; message: string };

/**
 * 선생님 홈("/tutor") - 보호자 홈(/parent)과 같은 생김새(인사 카드 → 큰 대표 카드 → "더 보기"가 달린 섹션).
 *
 *   1. 상단 바 - 브랜드 + 알림 벨.
 *   2. 인사 카드 - 오늘 수업 수. 반도 수업도 없는 첫 방문이면 시작 안내 + "새 반 만들기".
 *   3. 다음 수업 - 진행 중이거나 가장 가까운 예정 수업 한 개를 큰 카드로(첫 이야기 그림). 누르면 수업 상세.
 *   4. 수업 캘린더 - Lesson.scheduledAt 기준 월 그리드, 일자를 탭하면 그 날의 수업 목록.
 *   5. 수업에 쓸 이야기 - 서재로 가는 가로 카드 줄.
 *   6. 보호자 연결 대기 - 아직 보호자가 반 초대 링크로 연결하지 않은 아이.
 */
export function TutorHomePage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { state } = useAuth();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [stories, setStories] = useState<StoryCatalogEntry[]>([]);

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

  useEffect(() => {
    let cancelled = false;
    listStories()
      .then((list) => {
        if (!cancelled) setStories(list);
      })
      .catch(() => {
        // 이야기 줄·대표 카드 그림은 부가 정보라 실패해도 조용히 넘긴다.
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const nextLesson = useMemo(() => (load.status === 'ready' ? pickNextLesson(load.lessons, new Date()) : null), [load]);
  const todayCount = useMemo(() => (load.status === 'ready' ? countToday(load.lessons, new Date()) : 0), [load]);

  // 반도 수업도 아직 없는 첫 방문 - 빈 캘린더가 한 화면을 다 차지해 "새 반 만들기"가 접힌 아래로
  // 밀려나 있었다. 이때는 시작 안내와 CTA를 위로 올린다.
  const isFirstVisit = load.status === 'ready' && load.lessons.length === 0 && load.students.length === 0;

  if (state.status !== 'authenticated') return null;

  const greetingBody = isFirstVisit
    ? '반을 만들고 초대 링크를 보호자에게 보내면 아이들이 명단에 들어와요. 1:1 과외도 아이 한 명짜리 반으로 시작해요.'
    : load.status !== 'ready'
    ? '오늘 만날 아이와 수업을 준비해 보세요.'
    : todayCount > 0
    ? `오늘 수업이 ${todayCount}개 있어요.`
    : '오늘은 예정된 수업이 없어요. 다음 수업을 준비해 보세요.';
  const heroStory = nextLesson ? stories.find((story) => story.storyId === nextLesson.storyIds[0]) : undefined;

  return (
    <AppNavShell tone="warm" items={dashboardNavItems(state.user, navigate, pathname)}>
      <View style={styles.scroll}>
        <TopBar token={state.token} />

        <HomeGreetingCard title={`${teacherTitle(state.user.displayName)}, ${timeOfDayGreeting()}`} body={greetingBody}>
          {isFirstVisit ? (
            <View style={styles.greetingCta}>
              <ActionButton label="새 반 만들기" onPress={() => navigate(TUTOR_PATHS.newClass)} />
            </View>
          ) : null}
        </HomeGreetingCard>

        {nextLesson ? (
          <View style={styles.section}>
            <HomeSection title={nextLesson.status === 'IN_PROGRESS' ? '진행 중인 수업' : '다음 수업'} layout="list">
              <HomeHeroCard
                title={nextLesson.name}
                description={nextLesson.goal}
                coverImageUrl={heroStory?.coverImageUrl}
                fallbackIcon="calendarDays"
                ctaLabel={nextLesson.status === 'IN_PROGRESS' ? '수업 이어서 열기' : '수업 열기'}
                onPress={() => navigate(TUTOR_PATHS.lesson(nextLesson.id))}
                meta={
                  <View style={styles.metaRow}>
                    {nextLesson.scheduledAt ? <Pill label={lessonWhen(nextLesson.scheduledAt)} tone="onCard" /> : null}
                    {nextLesson.classGroupName ? <Pill label={nextLesson.classGroupName} tone="onCard" /> : null}
                    <Pill label={`학생 ${nextLesson.students.length}명`} tone="onCard" />
                    {heroStory ? <Pill label={heroStory.title} tone="onCard" /> : null}
                  </View>
                }
              />
            </HomeSection>
          </View>
        ) : null}

        <View style={styles.section}>
          <HomeSection title="수업 캘린더" layout="list" onSeeAll={() => navigate(TUTOR_PATHS.lessons)}>
            <Card variant="surface" padding="md" style={styles.calendarCard}>
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
          </HomeSection>
        </View>

        {stories.length > 0 ? (
          <View style={styles.section}>
            <HomeSection title="수업에 쓸 이야기" subtitle="수업에 넣기 전에 미리 읽어 볼 수 있어요." onSeeAll={() => navigate('/tutor/library')}>
              {stories.slice(0, 8).map((story) => (
                <StoryCard
                  key={story.storyId}
                  size="mini"
                  title={story.title}
                  coverImageUrl={story.coverImageUrl}
                  onPress={() => navigate(storyDestination(story, state))}
                  locked={unlockStateFor(story, state) === 'locked'}
                />
              ))}
            </HomeSection>
          </View>
        ) : null}

        <View style={styles.section}>
          <HomeSection title="보호자 연결 대기" layout="list" onSeeAll={() => navigate(TUTOR_PATHS.classes)}>
            {load.status === 'loading' ? (
              <LoadingState compact label="학생 목록을 불러오는 중이에요…" />
            ) : load.status === 'ready' && load.students.length === 0 ? (
              <EmptyState
                title="아직 반에 들어온 아이가 없어요"
                body="반 초대 링크를 보내면 보호자가 아이를 연결해요."
              />
            ) : pendingStudents.length === 0 ? (
              <EmptyState title="모든 아이의 보호자 연결이 끝났어요" body="새 아이가 들어오면 여기에 보여요." />
            ) : (
              pendingStudents.map((student) => (
                <HomeListRow
                  key={student.id}
                  icon="user"
                  label={`${student.name} · ${student.ageBand}`}
                  meta={student.classType}
                  trailing={<Pill label="보호자 연결 대기" tone="onLight" />}
                  onPress={() => navigate(TUTOR_PATHS.student(student.id))}
                  accessibilityLabel={`${student.name} 학생 상세 열기`}
                />
              ))
            )}
          </HomeSection>
        </View>

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
      <BrandLockup size="compact" />
      <NotificationBell token={token} />
    </View>
  );
}

function StatusPill({ status }: { status: Lesson['status'] }) {
  if (status === 'IN_PROGRESS') return <Text style={styles.statusInProgress}>진행 중</Text>;
  if (status === 'COMPLETED') return <Text style={styles.statusCompleted}>완료</Text>;
  return null;
}

const L = semanticColors.light;

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    width: '100%',
    alignItems: 'stretch',
    gap: 20,
    paddingHorizontal: storybookTheme.spacing.ml,
    paddingTop: storybookTheme.spacing.lg,
    paddingBottom: storybookTheme.spacing.xl,
  },
  topBar: {
    width: '100%',
    maxWidth: storybookTheme.layout.dashboardCardWideMaxWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  section: {
    width: '100%',
    maxWidth: storybookTheme.layout.dashboardCardWideMaxWidth,
    alignSelf: 'center',
  },
  pressed: { opacity: 0.85 },
  greetingCta: { marginTop: storybookTheme.spacing.sm, alignItems: 'flex-start' },
  calendarCard: { gap: storybookTheme.spacing.ms },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: storybookTheme.spacing.ms,
    paddingVertical: storybookTheme.spacing.sm,
    paddingHorizontal: storybookTheme.spacing.sm,
    borderRadius: radius[12],
    backgroundColor: L.bg.secondary,
    borderWidth: 1,
    borderColor: L.border.secondary,
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
});
