import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { AppNavShell, Icon, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, useAuth } from '@/entities/auth';
import { listStories, unlockStateFor, type StoryCatalogEntry } from '@/entities/story';
import { StoryCard } from '@/shared/ui/story-card';
import { HomeSection } from '@/features/home-section';
import { ChildSelector } from '@/features/child-selector';
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
  const [progress] = useState<LocalStoryProgress | null>(() => loadLocalStoryProgress());

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
          const message = error instanceof Error ? error.message : '이야기 목록을 불러오지 못했어요.';
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
    listStoryCompletions(state.token, filters)
      .then((list) => {
        if (!cancelled) setCompletions(list);
      })
      .catch(() => {
        // 최근 활동은 부가 섹션이라 실패해도 조용히 넘긴다 - 다른 섹션은 그대로 살아 있는다.
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
        <TopBar />

        <View style={[styles.card, isWide && styles.cardWide]}>
          <Text style={styles.eyebrow}>{timeOfDayGreeting()}</Text>
          <Text style={styles.title} accessibilityRole="header">
            {displayName}님과 오늘의 이야기
          </Text>
          <Text style={styles.body}>
            {selectedChild
              ? `${selectedChild.name}에게 딱 맞는 이야기를 골라 봤어요.`
              : '아이를 선택하면 그 아이에게 맞는 이야기를 추천해 줄게요.'}
          </Text>
        </View>

        <View style={styles.section}>
          <ChildSelector greeting="아이를 골라 주세요" />
        </View>

        {hero ? (
          <HeroRecommendation
            story={hero}
            onPress={() => navigate(`/stories/${hero.storyId}`)}
            locked={unlockStateFor(hero, state) === 'locked'}
          />
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

        {recentActivity.length > 0 ? (
          <View style={styles.recentSection}>
            <Text style={styles.recentSectionTitle} accessibilityRole="header">최근 활동</Text>
            {recentActivity.map((entry) => (
              <RecentActivityRow key={entry.id} entry={entry} onPress={() => {
                if (entry.kind === 'completion') navigate(`/reports/${entry.id}`);
              }} />
            ))}
          </View>
        ) : (
          <View style={styles.emptyRecent}>
            <Text style={styles.recentSectionTitle}>최근 활동</Text>
            <Text style={styles.emptyRecentBody}>
              첫 이야기를 끝까지 읽으면 여기에 기록이 남아요.
            </Text>
          </View>
        )}

        {storyLoadError && (stories?.length ?? 0) === 0 ? (
          <Text style={styles.errorText}>{storyLoadError}</Text>
        ) : null}
      </View>
    </AppNavShell>
  );
}

/* -------------------------------------------------------------------- helpers */

function TopBar() {
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="알림"
        onPress={() => {
          // 알림 백엔드는 아직 없다 - IA에는 있지만 unread count/센터를 이번 세션에 만들지 않았다.
          if (typeof window !== 'undefined') window.alert?.('알림 기능은 곧 준비돼요.');
        }}
        style={({ pressed }) => [styles.bellButton, pressed && styles.pressed]}
      >
        <Icon name="bell" size={18} color={storybookTheme.color.onDark} />
      </Pressable>
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
            <Icon name="book" size={36} color={storybookTheme.color.onDarkMuted} />
          </View>
        )}
        {locked ? (
          <View style={styles.heroLockBadge}>
            <Icon name="lock" size={16} color={storybookTheme.color.onDark} />
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
        <Icon name="chevronRight" size={16} color={storybookTheme.color.onDarkMuted} />
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
  return [...completionEntries, ...tutorEntries]
    .sort((a, b) => (b.iso > a.iso ? 1 : -1))
    .slice(0, 6);
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
    paddingHorizontal: 20,
    paddingVertical: 24,
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
    color: storybookTheme.color.onDark,
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    letterSpacing: 1.8,
  },
  brandWordmarkQ: { color: storybookTheme.color.gold },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: storybookTheme.color.panelOnDarkBackground,
    borderWidth: 1,
    borderColor: storybookTheme.color.panelOnDarkBorder,
  },
  pressed: { opacity: 0.85 },
  card: {
    width: '100%',
    maxWidth: storybookTheme.layout.dashboardCardMaxWidth,
    alignSelf: 'center',
    backgroundColor: storybookTheme.color.surfaceCard,
    borderRadius: storybookTheme.radius.card,
    paddingHorizontal: 22,
    paddingVertical: 22,
    gap: 6,
  },
  cardWide: {
    maxWidth: storybookTheme.layout.dashboardCardWideMaxWidth,
    paddingHorizontal: 32,
    paddingVertical: 28,
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
    gap: 8,
  },
  recentSectionTitle: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onDark,
    paddingHorizontal: 4,
  },
  emptyRecent: {
    width: '100%',
    maxWidth: storybookTheme.layout.dashboardCardWideMaxWidth,
    alignSelf: 'center',
    gap: 6,
    backgroundColor: storybookTheme.color.panelOnDarkBackground,
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    borderColor: storybookTheme.color.panelOnDarkBorder,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  emptyRecentBody: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onDarkMuted,
    paddingHorizontal: 4,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: storybookTheme.color.panelOnDarkBackground,
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    borderColor: storybookTheme.color.panelOnDarkBorder,
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
    color: storybookTheme.color.onDark,
  },
  recentMeta: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onDarkMuted,
  },
  errorText: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.error,
    textAlign: 'center',
  },
});
