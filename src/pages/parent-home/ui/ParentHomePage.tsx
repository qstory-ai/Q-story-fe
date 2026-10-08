import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigate, useLocation } from 'react-router-dom';

import { BrandLockup, AppNavShell, Card, EmptyState, Icon, LoadingState, Pill, StoryCard, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { relativeDayLabel, withParticle } from '@/shared/lib';
import { NotificationBell } from '@/features/notification-center';
import { dashboardNavItems, useAuth } from '@/entities/auth';
import { listStories, unlockStateFor, type StoryCatalogEntry } from '@/entities/story';
import { resumeStart, startStoryFromHome, storyDestination, storyPlayPath, type StartDecision } from '@/features/story-library';
import { HomeSection } from '@/features/home-section';
import { ChildPickerModal, ChildSelector } from '@/features/child-selector';
import { primeResponseAudio } from '@/features/route-question';
import { AGE_BAND_CATEGORY_HINTS, AGE_BAND_LABELS, useChildren, type AgeBand } from '@/entities/child';
import { hasKoreanBatchim } from '@/entities/narration';
import { loadLocalStoryProgress, progressForSelectedChild, type LocalStoryProgress } from '@/entities/analytics';
import { EXITED_BADGE_LABEL, isExitedSession, listStoryCompletions, type StoryCompletionSummary } from '@/entities/story-completion';
import { listParentTutorReports, tutorReportSource, type TutorReportSummary } from '@/entities/tutor';
import { formatReportDuration } from '@/pages/one-story';

/**
 * 부모 홈("/parent") - IA "[1] 홈"의 아이 중심 큐레이션 화면:
 *
 *   1. 상단 바 - 브랜드 + 알림 벨.
 *   2. 아이 선택 - 넷플릭스식 아바타 로우. 이 컴포넌트가 selectedChild를 바꿔 놓으면 아래
 *      섹션들이 그 아이 기준으로 다시 계산된다.
 *   3. 메인 추천 히어로 - 아이 연령대에 맞는 대표 이야기 한 편(크게). 매칭 규칙은 아래 함수
 *      참조. 폴백은 카탈로그의 첫 번째 이야기. 누르면 상세를 거치지 않고 선택된 아이로 바로
 *      플레이어를 연다(startStoryFromHome).
 *   4. 이어서 읽기 - 브라우저 하나당 최대 1개인 LocalStoryProgress를 그대로 카드화. 진행을 남긴
 *      아이로 재생한다(resumeStart).
 *   5. 아이에게 추천하는 작품 - 아이 연령대 카테고리 힌트에 맞는 이야기 먼저, 나머지는 새 작품 순.
 *   6. 최근 리포트 - 가장 최근 리포트 몇 건만. 전체 목록·달력은 리포트 탭이 맡는다.
 *
 * 전체 카탈로그는 /library 탭이 맡는다.
 */
export function ParentHomePage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { state } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 640;
  const { children, selectedChild } = useChildren();
  // 아이가 없거나(등록) 누구의 진행인지 모를 때(이어서 읽기) 띄우는 아이 선택 - 고르면 그 아이로 재생한다.
  const [picker, setPicker] = useState<{ storyId: string; resume: boolean } | null>(null);

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
  const progress = useMemo(
    () => progressForSelectedChild(loadLocalStoryProgress(), children.map((child) => child.id), selectedChild?.id),
    [children, selectedChild?.id],
  );
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

  const token = state.status === 'authenticated' ? state.token : null;
  const selectedChildId = selectedChild?.id ?? null;
  const selectedAgeBand = selectedChild?.ageBand ?? null;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    // 선택된 아이가 있으면 그 아이 완주만, 없으면(=아이 미등록) 전체 완주.
    const filters = selectedChildId ? { childId: selectedChildId } : undefined;
    // 요청 시점의 key로 응답 완료를 표시해, 아이 전환 직후엔 다시 "불러오는 중"으로 도출되게 한다.
    const requestKey = selectedChildId ?? 'all';
    listStoryCompletions(token, filters)
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
  }, [token, selectedChildId]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    listParentTutorReports(token)
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
  }, [token]);

  const hero = useMemo(() => pickHero(stories ?? [], selectedAgeBand), [stories, selectedAgeBand]);
  const forChild = useMemo(
    () => pickForChild(stories ?? [], selectedAgeBand, hero?.storyId),
    [stories, selectedAgeBand, hero],
  );
  const recentActivity = useMemo(
    () => mergeRecentActivity(completions, tutorReports, stories ?? []).slice(0, RECENT_REPORT_LIMIT),
    [completions, tutorReports, stories],
  );

  if (state.status !== 'authenticated') return null;

  const displayName = selectedChild?.name ?? state.user.displayName;
  const follow = (decision: StartDecision, storyId: string, resume: boolean) => {
    // 탭 핸들러 안에서 동기로 - iOS는 사용자 탭 뒤에 준비된 오디오만 이후 낭독 재생을 허용한다.
    primeResponseAudio();
    if (decision.kind === 'navigate') navigate(decision.path);
    else setPicker({ storyId, resume });
  };
  // 아이가 둘 이상이면 버튼에 누구와 시작하는지 적는다 - 상세 화면의 아이 선택 단계를 이 문구가 대신한다.
  const heroCtaLabel = selectedChild && children.length > 1
    ? `${withParticle(selectedChild.name, '과/와')} 이야기 시작하기`
    : '이야기 시작하기';

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, pathname)}>
      <View style={styles.scroll}>
        <TopBar token={state.token} />

        {/* 아이가 선택된 경우에만 인사말 카드 - 미선택 케이스는 아래 ChildSelector가 "아이를
            골라 주세요"로 이미 안내하므로 카드가 중복 문구가 된다. */}
        {selectedChild ? (
          <Card variant="surface" padding="lg" style={[styles.greetingCard, isWide && styles.greetingCardWide]}>
            <Text style={styles.title} accessibilityRole="header">
              {/* "님과"(존칭) 대신 아이 이름에 받침 유무로 이/와를 붙이는 애칭 톤 - 다른 화면의
                  아이 이름 개인화(child-address.ts)와 같은 방식. */}
              {selectedChild.name}{hasKoreanBatchim(selectedChild.name) ? '이와' : '와'} 오늘의 이야기
            </Text>
            <Text style={styles.body}>{timeOfDayGreeting()}. {selectedChild.name}에게 딱 맞는 이야기를 골라 봤어요.</Text>
          </Card>
        ) : null}

        <View style={styles.section}>
          <ChildSelector greeting="아이를 골라 주세요" />
        </View>

        {hero ? (
          <HeroRecommendation
            story={hero}
            ctaLabel={heroCtaLabel}
            onPress={() =>
              follow(
                startStoryFromHome({ story: hero, auth: state, children, selectedChildId: selectedChild?.id ?? null, progress }),
                hero.storyId,
                false,
              )
            }
            locked={unlockStateFor(hero, state) === 'locked'}
          />
        ) : catalogLoading ? (
          <Card variant="panel" padding="lg" style={styles.heroLoader}>
            <LoadingState compact label="이야기를 준비하는 중이에요…" />
          </Card>
        ) : null}

        {progress ? (
          <View style={styles.section}>
            <HomeSection
              title="이어서 읽기"
              subtitle={`${withParticle(selectedChild?.name || progress.childName || displayName, '이/가')} ${relativeDayLabel(progress.savedAt)} 읽던 이야기예요.`}
            >
              <ContinueReadingCard
                progress={progress}
                stories={stories ?? []}
                onPress={() => follow(resumeStart({ progress, children }), progress.storyId, true)}
              />
            </HomeSection>
          </View>
        ) : null}

        {forChild.length > 0 ? (
          <View style={styles.section}>
            <HomeSection
              title={selectedChild ? `${selectedChild.name}에게 추천하는 작품` : '아이에게 추천하는 작품'}
              subtitle={selectedChild ? AGE_BAND_LABELS[selectedChild.ageBand] + '에 어울리는 이야기예요.' : undefined}
              onSeeAll={() => navigate('/library')}
            >
              {forChild.map((story) => (
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

        {/* 리포트 목록·달력은 리포트 탭에 하나로 둔다 - 홈에는 최근 몇 건과 바로가기만. */}
        <View style={styles.section}>
          <HomeSection title="최근 리포트" layout="list" onSeeAll={() => navigate('/reports')}>
            {activityLoading ? (
              <LoadingState compact label="리포트를 불러오는 중이에요…" />
            ) : recentActivity.length === 0 ? (
              <EmptyState
                title="아직 리포트가 없어요"
                body="첫 이야기를 끝까지 읽으면 여기에 리포트가 생겨요."
              />
            ) : (
              recentActivity.map((entry) => (
                <RecentActivityRow
                  key={entry.id}
                  entry={entry}
                  onPress={() => navigate(`/reports/${entry.id}?from=home_card`)}
                />
              ))
            )}
          </HomeSection>
        </View>

        {storyLoadError && (stories?.length ?? 0) === 0 ? (
          <Text style={styles.errorText}>{storyLoadError}</Text>
        ) : null}
      </View>

      <ChildPickerModal
        visible={picker !== null}
        subtitle={picker?.resume ? '누구의 이야기를 이어서 읽을까요?' : '어떤 아이와 함께 볼까요?'}
        onClose={() => setPicker(null)}
        onSelected={(child) => {
          if (!picker) return;
          setPicker(null);
          // 고른 아이가 진행을 남긴 아이일 때만 이어 읽고, 아니면 처음부터 시작한다(이어 읽기 후보가 없으면 플레이어가 멈춘다).
          const ownsProgress = picker.resume && progress?.storyId === picker.storyId && progress.childId === child.id;
          navigate(storyPlayPath(picker.storyId, { childId: child.id, resume: ownsProgress, from: ownsProgress ? undefined : 'home' }));
        }}
      />
    </AppNavShell>
  );
}

/** 홈의 최근 리포트 개수 - 나머지는 리포트 탭에서 본다. */
const RECENT_REPORT_LIMIT = 3;

/* -------------------------------------------------------------------- helpers */

function TopBar({ token }: { token: string }) {
  return (
    <View style={styles.topBar}>
      <BrandLockup size="compact" tone="onLight" />
      <NotificationBell token={token} />
    </View>
  );
}

function HeroRecommendation({
  story,
  ctaLabel,
  onPress,
  locked,
}: {
  story: StoryCatalogEntry;
  ctaLabel: string;
  onPress: () => void;
  locked: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${story.title} ${ctaLabel}`}
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
        <Text style={styles.heroTitle} accessibilityRole="header" numberOfLines={2}>
          {story.title}
        </Text>
        {story.description ? (
          <Text style={styles.heroDescription} numberOfLines={3}>{story.description}</Text>
        ) : null}
        <View style={styles.heroCta}>
          <Text style={styles.heroCtaLabel}>{ctaLabel}</Text>
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
  | { id: string; kind: 'completion'; label: string; meta: string; iso: string; exited?: boolean }
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
      accessibilityRole="link"
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
      {entry.kind === 'completion' && entry.exited ? <Pill label={EXITED_BADGE_LABEL} tone="onLight" /> : null}
      <Icon name="chevronRight" size={16} color={storybookTheme.color.onContentMuted} />
    </Pressable>
  );
}

function timeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return '좋은 아침이에요';
  if (hour < 18) return '좋은 오후예요';
  return '좋은 저녁이에요';
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
  if (!ageBand) {
    return [...filtered].sort((a, b) => (b.contentVersion || '').localeCompare(a.contentVersion || '')).slice(0, 8);
  }
  const hints = AGE_BAND_CATEGORY_HINTS[ageBand];
  const matches = filtered.filter((story) => story.category && hints.includes(story.category));
  // 매칭이 부족할 땐 나머지를 새 작품 순으로 채운다 - 따로 있던 "새로운 작품" 줄을 이 줄에 합쳤다.
  // 신작 플래그가 아직 스키마에 없어 contentVersion 내림차순으로 대신한다.
  const rest = filtered
    .filter((story) => !matches.includes(story))
    .sort((a, b) => (b.contentVersion || '').localeCompare(a.contentVersion || ''));
  return [...matches, ...rest].slice(0, 8);
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
      exited: isExitedSession(completion),
    };
  });
  const tutorEntries: RecentActivityEntry[] = tutorReports.map((report) => ({
    id: report.id,
    kind: 'tutor-report' as const,
    label: `${stories.find((s) => s.storyId === report.storyId)?.title ?? report.storyId} · ${tutorReportSource(report)}`,
    meta: `${formatDate(report.completedAt)} · ${formatReportDuration(report.durationSeconds)}`,
    iso: report.completedAt,
  }));
  return [...completionEntries, ...tutorEntries].sort((a, b) => (b.iso > a.iso ? 1 : -1));
}

const MONTH_DAY_FORMAT = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' });

function formatDate(iso: string) {
  return MONTH_DAY_FORMAT.format(new Date(iso));
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
  // 카탈로그 로딩 중 히어로 자리 placeholder.
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
    color: storybookTheme.color.goldText,
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
