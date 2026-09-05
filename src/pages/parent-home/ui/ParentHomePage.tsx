import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { AppNavShell, Card, EmptyState, Icon, LoadingState, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { NotificationBell } from '@/features/notification-center';
import { dashboardNavItems, useAuth } from '@/entities/auth';
import { listStories, unlockStateFor, type StoryCatalogEntry } from '@/entities/story';
import { StoryCard } from '@/shared/ui/story-card';
import { HomeSection } from '@/features/home-section';
import { ChildSelector } from '@/features/child-selector';
import { MonthCalendar } from '@/features/month-calendar';
import { AGE_BAND_CATEGORY_HINTS, useChildren, type AgeBand } from '@/entities/child';
import { loadLocalStoryProgress, type LocalStoryProgress } from '@/entities/analytics';
import { listStoryCompletions, type StoryCompletionSummary } from '@/entities/story-completion';
import { listParentTutorReports, type TutorReportSummary } from '@/entities/tutor';
import { formatReportDuration } from '@/pages/one-story';

/**
 * 부모 홈("/parent") - IA "[1] 홈" 섹션을 실제로 반영한 화면. 예전에는 브랜드 헤더 + 인사말
 * 카드 + StoryLibraryGrid(전체 카탈로그) + 최근 완주 카드 하나뿐이었는데, 이번엔 IA의
 * "아이 중심 큐레이션" 요구에 맞춰 다음 순서로 재구성했다:
 *
 *   1. 상단 바 - 브랜드 + 알림 벨(현재는 스텁; 눌러도 안내만).
 *   2. 아이 선택 - 넷플릭스식 아바타 로우. 이 컴포넌트가 selectedChild를 바꿔 놓으면 아래
 *      섹션들이 그 아이 기준으로 다시 계산된다.
 *   3. 메인 추천 히어로 - 아이 연령대에 맞는 대표 이야기 한 편(크게). 매칭 규칙은 아래 함수
 *      참조. 폴백은 카탈로그의 첫 번째 이야기.
 *   4. 이어서 읽기 - 브라우저 하나당 최대 1개인 LocalStoryProgress를 그대로 카드화.
 *   5. 아이에게 추천하는 작품 - 아이 연령대 카테고리 힌트로 필터한 스토리 리스트.
 *   6. 새로운 작품 - contentVersion 내림차순.
 *   7. 최근 활동 - 완주 기록 + 선생님 리포트 병합, 시간 내림차순.
 *
 * 전체 카탈로그(StoryLibraryGrid)는 이 화면에서 제거되어 새 /library 탭으로 이전됐다 - 홈이
 * "탐색 그리드"가 아니라 "오늘의 큐레이션" 역할을 하도록.
 */
export function ParentHomePage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 640;
  const { selectedChild } = useChildren();

  const [stories, setStories] = useState<StoryCatalogEntry[] | null>(null);
  const [storyLoadError, setStoryLoadError] = useState<string | null>(null);
  const [completions, setCompletions] = useState<StoryCompletionSummary[]>([]);
  const [tutorReports, setTutorReports] = useState<TutorReportSummary[]>([]);
  // 로딩 상태는 "지금 어느 아이 기준으로 요청했고, 어느 아이 응답이 왔는지"를 request/response
  // key로 비교해 도출한다 - setState-in-effect 없이 selectedChild 전환 순간에도 자연스럽게
  // "불러오는 중"으로 돌아간다. 응답 key는 fetch를 시작한 시점의 아이 id + 'all' 폴백.
  const completionsRequestKey = selectedChild?.id ?? 'all';
  const [completionsResponseKey, setCompletionsResponseKey] = useState<string | null>(null);
  const [reportsDone, setReportsDone] = useState(false);
  const [progress] = useState<LocalStoryProgress | null>(() => loadLocalStoryProgress());
  const catalogLoading = stories === null;
  const completionsDone = completionsResponseKey === completionsRequestKey;
  const activityLoading = !completionsDone || !reportsDone;

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'PARENT') {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  useEffect(() => {
    let cancelled = false;
    listStories()
      .then((list) => {
        if (!cancelled) setStories(list);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = messageForError(error, '이야기 목록을 불러오지 못했어요.');
          setStoryLoadError(message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state.status !== 'authenticated') return;
    let cancelled = false;
    // 선택된 아이가 있으면 그 아이 완주만, 없으면(=아이 미등록) 전체 완주. 아이 선택기에서
    // 다른 아이로 바꾸면 최근 활동 카드도 자연스럽게 그 아이 기준으로 갱신된다.
    const filters = selectedChild ? { childId: selectedChild.id } : undefined;
    // 요청 시작 시점의 key를 캡처해, finally에서 그 key로 응답 완료 표시를 남긴다. 위의
    // completionsRequestKey와 이 responseKey가 일치할 때만 completionsDone=true로 도출된다.
    const requestKey = selectedChild?.id ?? 'all';
    listStoryCompletions(state.token, filters)
      .then((list) => {
        if (!cancelled) setCompletions(list);
      })
      .catch(() => {
        // 최근 활동은 부가 섹션이라 실패해도 조용히 넘긴다 - 다른 섹션은 그대로 살아 있는다.
      })
      .finally(() => {
        if (!cancelled) setCompletionsResponseKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
  }, [state, selectedChild]);

  useEffect(() => {
    if (state.status !== 'authenticated') return;
    let cancelled = false;
    listParentTutorReports(state.token)
      .then((list) => {
        if (!cancelled) setTutorReports(list);
      })
      .catch(() => {
        // 위와 같은 이유로 조용히 무시.
      })
      .finally(() => {
        if (!cancelled) setReportsDone(true);
      });
    return () => {
      cancelled = true;
    };
  }, [state]);

  const hero = useMemo(() => pickHero(stories ?? [], selectedChild?.ageBand ?? null), [stories, selectedChild]);
  const forChild = useMemo(
    () => pickForChild(stories ?? [], selectedChild?.ageBand ?? null, hero?.storyId),
    [stories, selectedChild, hero],
  );
  const newStories = useMemo(() => pickNew(stories ?? [], hero?.storyId), [stories, hero]);
  const recentActivity = useMemo(
    () => mergeRecentActivity(completions, tutorReports, stories ?? []),
    [completions, tutorReports, stories],
  );

  if (state.status !== 'authenticated') return null;

  const displayName = selectedChild?.name ?? state.user.displayName;

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, 'home')}>
      <View style={styles.scroll}>
        <TopBar token={state.token} />

        {/* 아이가 선택된 경우에만 인사말 카드 - 미선택 케이스는 아래 ChildSelector가 "아이를
            골라 주세요"로 이미 안내하므로 카드가 중복 문구가 된다. */}
        {selectedChild ? (
          <Card variant="surface" padding="lg" style={[styles.greetingCard, isWide && styles.greetingCardWide]}>
            <Text style={styles.eyebrow}>{timeOfDayGreeting()}</Text>
            <Text style={styles.title} accessibilityRole="header">
              {selectedChild.name}님과 오늘의 이야기
            </Text>
            <Text style={styles.body}>{selectedChild.name}에게 딱 맞는 이야기를 골라 봤어요.</Text>
          </Card>
        ) : null}

        <View style={styles.section}>
          <ChildSelector greeting="아이를 골라 주세요" />
        </View>

        {hero ? (
          <HeroRecommendation
            story={hero}
            onPress={() => navigate(`/stories/${hero.storyId}`)}
            locked={unlockStateFor(hero, state) === 'locked'}
          />
        ) : catalogLoading ? (
          <Card variant="panel" padding="lg" style={styles.heroLoader}>
            <LoadingState compact label="이야기를 준비하는 중이에요…" />
          </Card>
        ) : null}

        {progress ? (
          <HomeSection
            title="이어서 읽기"
            subtitle={`${progress.childName || displayName}님이 어제 읽던 이야기예요.`}
          >
            <ContinueReadingCard
              progress={progress}
              stories={stories ?? []}
              onPress={() => navigate(`/stories/${progress.storyId}/play`)}
            />
          </HomeSection>
        ) : null}

        {forChild.length > 0 ? (
          <HomeSection
            title={selectedChild ? `${selectedChild.name}에게 추천하는 작품` : '아이에게 추천하는 작품'}
            subtitle={selectedChild ? ageBandLabel(selectedChild.ageBand) + '에 어울리는 이야기예요.' : undefined}
            onSeeAll={() => navigate('/library')}
          >
            {forChild.map((story) => (
              <StoryCard
                key={story.storyId}
                size="mini"
                title={story.title}
                coverImageUrl={story.coverImageUrl}
                onPress={() => navigate(`/stories/${story.storyId}`)}
                locked={unlockStateFor(story, state) === 'locked'}
              />
            ))}
          </HomeSection>
        ) : null}

        {newStories.length > 0 ? (
          <HomeSection title="새로운 작품" subtitle="새로 준비한 이야기들이에요." onSeeAll={() => navigate('/library')}>
            {newStories.map((story) => (
              <StoryCard
                key={story.storyId}
                size="mini"
                title={story.title}
                coverImageUrl={story.coverImageUrl}
                onPress={() => navigate(`/stories/${story.storyId}`)}
                locked={unlockStateFor(story, state) === 'locked'}
              />
            ))}
          </HomeSection>
        ) : null}

        {/* 활동 캘린더 - 예전엔 최근 6개를 평면 리스트로 보여줬는데, 부모가 "이 달에 몇 번이나
            읽었지?"를 한눈에 파악하기 어려웠다. 애플 캘린더식 월 그리드에 완주/리포트를 dot으로
            표시하고, 특정 일자를 탭하면 그 아래 목록이 뜬다. */}
        <Card variant="panel" padding="md" title="이 달의 활동" style={styles.calendarPanel}>
          {activityLoading ? (
            <LoadingState compact label="활동 기록을 불러오는 중이에요…" />
          ) : recentActivity.length === 0 ? (
            <EmptyState
              title="아직 활동 기록이 없어요"
              body="첫 이야기를 끝까지 읽으면 여기에 기록이 남아요."
            />
          ) : (
            <MonthCalendar
              items={recentActivity.map((entry) => ({ id: entry.id, date: new Date(entry.iso), entry }))}
              emptyDayMessage="이 날에는 활동 기록이 없어요."
              renderItem={(item) => (
                <RecentActivityRow
                  key={item.entry.id}
                  entry={item.entry}
                  onPress={() => {
                    if (item.entry.kind === 'completion') navigate(`/reports/${item.entry.id}`);
                  }}
                />
              )}
            />
          )}
        </Card>

        {storyLoadError && (stories?.length ?? 0) === 0 ? (
          <Text style={styles.errorText}>{storyLoadError}</Text>
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

function HeroRecommendation({
  story,
  onPress,
  locked,
}: {
  story: StoryCatalogEntry;
  onPress: () => void;
  locked: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${story.title} 자세히 보기`}
      onPress={onPress}
      style={({ pressed }) => [styles.hero, pressed && styles.pressed]}
    >
      <View style={styles.heroCoverFrame}>
        {story.coverImageUrl ? (
          <Image source={{ uri: story.coverImageUrl }} resizeMode="cover" style={styles.heroCover} />
        ) : (
          <View style={styles.heroCoverFallback}>
            <Icon name="book" size={36} color={storybookTheme.color.onContentMuted} />
          </View>
        )}
        {locked ? (
          <View style={styles.heroLockBadge}>
            <Icon name="lock" size={16} color={storybookTheme.color.onContent} />
          </View>
        ) : null}
      </View>
      <View style={styles.heroBody}>
        <Text style={styles.heroEyebrow}>오늘의 추천</Text>
        <Text style={styles.heroTitle} accessibilityRole="header" numberOfLines={2}>
          {story.title}
        </Text>
        {story.description ? (
          <Text style={styles.heroDescription} numberOfLines={3}>{story.description}</Text>
        ) : null}
        <View style={styles.heroCta}>
          <Text style={styles.heroCtaLabel}>이야기 시작하기</Text>
          <Icon name="chevronRight" size={16} color={storybookTheme.color.gold} />
        </View>
      </View>
    </Pressable>
  );
}

function ContinueReadingCard({
  progress,
  stories,
  onPress,
}: {
  progress: LocalStoryProgress;
  stories: StoryCatalogEntry[];
  onPress: () => void;
}) {
  const story = stories.find((s) => s.storyId === progress.storyId);
  // 진행률 근사치: elapsedSeconds를 12분 기준으로 나눈다. 실제 총 시간이 저장되지 않아서
  // 정확한 비율은 아직 알 수 없고, 이 근사치는 "얼마나 진행됐는지" 감만 준다(0.05~0.95 clamp).
  const rawProgress = Math.min(0.95, Math.max(0.05, progress.elapsedSeconds / (12 * 60)));
  return (
    <StoryCard
      size="mini"
      title={story?.title ?? '이어서 읽기'}
      coverImageUrl={story?.coverImageUrl}
      onPress={onPress}
      progress={rawProgress}
    />
  );
}

type RecentActivityEntry =
  | { id: string; kind: 'completion'; label: string; meta: string; iso: string }
  | { id: string; kind: 'tutor-report'; label: string; meta: string; iso: string };

function RecentActivityRow({
  entry,
  onPress,
}: {
  entry: RecentActivityEntry;
  onPress: () => void;
}) {
  const iconName = entry.kind === 'completion' ? 'sparkles' : 'users';
  return (
    <Pressable
      accessibilityRole={entry.kind === 'completion' ? 'link' : 'text'}
      onPress={onPress}
      style={({ pressed }) => [styles.recentRow, pressed && styles.pressed]}
    >
      <View style={styles.recentIcon}>
        <Icon name={iconName} size={16} color={storybookTheme.color.gold} />
      </View>
      <View style={styles.recentText}>
        <Text style={styles.recentLabel} numberOfLines={1}>{entry.label}</Text>
        <Text style={styles.recentMeta} numberOfLines={1}>{entry.meta}</Text>
      </View>
      {entry.kind === 'completion' ? (
        <Icon name="chevronRight" size={16} color={storybookTheme.color.onContentMuted} />
      ) : null}
    </Pressable>
  );
}

function timeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return '좋은 아침이에요';
  if (hour < 18) return '좋은 오후예요';
  return '좋은 저녁이에요';
}

function ageBandLabel(band: AgeBand) {
  const map: Record<AgeBand, string> = {
    '4-5': '4-5세',
    '6-7': '6-7세',
    '8-9': '8-9세',
    '10-11': '10-11세',
    '12+': '12세 이상',
  };
  return map[band];
}

/**
 * 히어로 선정: 아이 연령대의 카테고리 힌트에 매칭되는 이야기 중 첫 번째. 매칭이 없으면
 * 카탈로그의 첫 번째 이야기(사실상 HG 대표작).
 */
function pickHero(stories: StoryCatalogEntry[], ageBand: AgeBand | null): StoryCatalogEntry | null {
  if (stories.length === 0) return null;
  if (!ageBand) return stories[0];
  const hints = AGE_BAND_CATEGORY_HINTS[ageBand];
  const match = stories.find((story) => story.category && hints.includes(story.category));
  return match ?? stories[0];
}

function pickForChild(
  stories: StoryCatalogEntry[],
  ageBand: AgeBand | null,
  excludeStoryId: string | null | undefined,
): StoryCatalogEntry[] {
  if (stories.length === 0) return [];
  const filtered = stories.filter((story) => story.storyId !== excludeStoryId);
  if (!ageBand) return filtered.slice(0, 8);
  const hints = AGE_BAND_CATEGORY_HINTS[ageBand];
  const matches = filtered.filter((story) => story.category && hints.includes(story.category));
  // 매칭이 부족할 땐 나머지로 채워서 최소 5장은 확보한다 - 빈 캐러셀보다는 큐레이션 완화가 낫다.
  const rest = filtered.filter((story) => !matches.includes(story));
  return [...matches, ...rest].slice(0, 8);
}

function pickNew(stories: StoryCatalogEntry[], excludeStoryId: string | null | undefined): StoryCatalogEntry[] {
  // 신작 플래그가 아직 스키마에 없어 contentVersion 내림차순으로 대체 - 새 콘텐츠 버전이 곧
  // 최신 릴리즈라는 팀 관행에 기대는 근사치.
  return [...stories]
    .filter((story) => story.storyId !== excludeStoryId)
    .sort((a, b) => (b.contentVersion || '').localeCompare(a.contentVersion || ''))
    .slice(0, 8);
}

function mergeRecentActivity(
  completions: StoryCompletionSummary[],
  tutorReports: TutorReportSummary[],
  stories: StoryCatalogEntry[],
): RecentActivityEntry[] {
  const completionEntries: RecentActivityEntry[] = completions.map((completion) => {
    const story = stories.find((s) => s.storyId === completion.storyId);
    return {
      id: completion.id,
      kind: 'completion' as const,
      label: story?.title ?? completion.storyId,
      meta: `${formatDate(completion.completedAt)} · ${formatReportDuration(completion.durationSeconds)}`,
      iso: completion.completedAt,
    };
  });
  const tutorEntries: RecentActivityEntry[] = tutorReports.map((report) => ({
    id: report.id,
    kind: 'tutor-report' as const,
    label: `${report.tutorDisplayName} · ${report.studentName}`,
    meta: `${formatDate(report.completedAt)} · ${formatReportDuration(report.durationSeconds)}`,
    iso: report.completedAt,
  }));
  // 캘린더가 이 달 전체의 dot을 그리려면 최근 6개로 자르면 안 된다 - 지금은 60개까지 남긴다
  // (한 달에 60회면 어차피 화면 상 dot 하나로 뭉치므로 상한만 있으면 됨). 위 매핑이 이미
  // 최신순 정렬이라 오래된 것부터 잘려나간다.
  return [...completionEntries, ...tutorEntries]
    .sort((a, b) => (b.iso > a.iso ? 1 : -1))
    .slice(0, 60);
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(new Date(iso));
}

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
  // Card 프리미티브(padding='lg'=spacing.lg)를 쓰되 인사 카드만 maxWidth/gap을 페이지 컨텍스트에
  // 맞게 오버라이드한다. 넓은 화면에서는 dashboardCardWide(760)까지 늘어난다.
  greetingCard: {
    maxWidth: storybookTheme.layout.dashboardCardMaxWidth,
    alignSelf: 'center',
    gap: storybookTheme.spacing.xs,
  },
  greetingCardWide: {
    maxWidth: storybookTheme.layout.dashboardCardWideMaxWidth,
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
  section: {
    width: '100%',
    maxWidth: storybookTheme.layout.dashboardCardWideMaxWidth,
    alignSelf: 'center',
  },
  hero: {
    width: '100%',
    maxWidth: storybookTheme.layout.dashboardCardWideMaxWidth,
    alignSelf: 'center',
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    overflow: 'hidden',
  },
  // 히어로 자리에 카탈로그가 아직 안 왔을 때 잠깐 뜨는 loading placeholder - hero와 같은
  // 가로 폭을 잡되 세로는 spinner + 여백만 있는 얇은 카드.
  heroLoader: {
    maxWidth: storybookTheme.layout.dashboardCardWideMaxWidth,
    alignSelf: 'center',
    alignItems: 'center',
    minHeight: 96,
    justifyContent: 'center',
  },
  heroCoverFrame: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: storybookTheme.color.coverFallback,
  },
  heroCover: { width: '100%', height: '100%' },
  heroCoverFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroLockBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18, 10, 30, 0.6)',
  },
  heroBody: { padding: 22, gap: 6 },
  heroEyebrow: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.gold,
    letterSpacing: 0.4,
  },
  heroTitle: {
    fontSize: storybookTheme.type.xl,
    lineHeight: storybookTheme.type.xl * storybookTheme.lineHeight.tight,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onCardTitle,
  },
  heroDescription: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onCardBody,
  },
  heroCta: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroCtaLabel: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.gold,
  },
  recentSection: {
    width: '100%',
    maxWidth: storybookTheme.layout.dashboardCardWideMaxWidth,
    alignSelf: 'center',
  },
  calendarPanel: {
    width: '100%',
    maxWidth: storybookTheme.layout.dashboardCardWideMaxWidth,
    alignSelf: 'center',
    gap: storybookTheme.spacing.ms,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: storybookTheme.color.contentPanel,
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentPanelBorder,
  },
  recentIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 204, 102, 0.12)',
  },
  recentText: { flex: 1, gap: 2 },
  recentLabel: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onContent,
  },
  recentMeta: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onContentMuted,
  },
  errorText: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.error,
    textAlign: 'center',
  },
});
