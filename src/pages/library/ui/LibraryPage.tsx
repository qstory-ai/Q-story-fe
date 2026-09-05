import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, AppNavShell, Card, FilterChip, SearchField, StoryCard, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { dashboardNavItems, useAuth, type AuthState } from '@/entities/auth';
import {
  DEFAULT_BETA_STORY_ID,
  listStories,
  unlockStateFor,
  type StoryCatalogEntry,
} from '@/entities/story';
import { useBookmarks } from '@/entities/bookmark';
import { useChildren } from '@/entities/child';
import { listStoryCompletions, type StoryCompletionSummary } from '@/entities/story-completion';
import { loadLocalStoryProgress, type LocalStoryProgress } from '@/entities/analytics';

type Tab = 'all' | 'in-progress' | 'read' | 'saved';
type CatalogLoad = { status: 'loading' } | { status: 'ready'; stories: StoryCatalogEntry[] } | { status: 'error'; message: string };
type CompletionsLoad = { status: 'loading' } | { status: 'ready'; completions: StoryCompletionSummary[] } | { status: 'error' };

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'in-progress', label: '읽는 중' },
  { key: 'read', label: '읽은 작품' },
  { key: 'saved', label: '저장한 작품' },
];

/**
 * IA "[2] 서재" 화면. 상단에 검색 + 카테고리 필터, 그 아래에 서브탭(전체/읽는 중/읽은/저장한).
 * 각 서브탭은 다른 데이터 소스를 쓴다:
 *   - 전체: listStories() 카탈로그
 *   - 읽는 중: LocalStoryProgress 하나 (브라우저 한 개, 로컬 스토리지)
 *   - 읽은: listStoryCompletions() 결과 → storyId dedupe → 카탈로그와 join
 *   - 저장한: useBookmarks().bookmarks → 카탈로그와 join
 *
 * 검색/카테고리 필터는 "전체" 탭에서 강력히 작동하고, 나머지 탭에서도 클라이언트 필터로 함께
 * 적용된다 - 각 하위 리스트가 이미 작은 편이라 성능은 문제되지 않는다.
 */
export function LibraryPage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const { width } = useWindowDimensions();
  const columns = width >= 860 ? 3 : width >= 520 ? 2 : 1;
  const bookmarks = useBookmarks();
  const { selectedChild } = useChildren();

  const [catalog, setCatalog] = useState<CatalogLoad>({ status: 'loading' });
  const [completions, setCompletions] = useState<CompletionsLoad>({ status: 'loading' });
  const [progress] = useState<LocalStoryProgress | null>(() => loadLocalStoryProgress());
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'PARENT') {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  useEffect(() => {
    let cancelled = false;
    listStories()
      .then((stories) => {
        if (!cancelled) setCatalog({ status: 'ready', stories });
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        setCatalog({
          status: 'error',
          message: messageForError(failure, '이야기 목록을 불러오지 못했어요. 네트워크 상태를 확인해 주세요.'),
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state.status !== 'authenticated') return;
    let cancelled = false;
    // 선택된 아이가 있으면 그 아이 완주만, 없으면(=아이 미등록) 전체 완주. 아이 선택기에서
    // 다른 아이로 바꾸면 '읽은 작품' 탭도 그 아이 기준으로 자동 갱신된다. legacy 기록
    // (childId 없음)은 특정 아이 필터에서 제외 - 리포트 페이지와 같은 규약.
    const filters = selectedChild ? { childId: selectedChild.id } : undefined;
    listStoryCompletions(state.token, filters)
      .then((list) => {
        if (!cancelled) setCompletions({ status: 'ready', completions: list });
      })
      .catch(() => {
        // 읽은 작품 탭이 잠깐 비어 보이는 편이 흰 화면보다 낫다.
        if (!cancelled) setCompletions({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [state, selectedChild]);

  // catalog.status === 'ready' ? catalog.stories : [] 를 그대로 쓰면 매 렌더마다 새로운 빈 배열
  // 참조가 만들어져 아래 useMemo들의 dep가 계속 바뀐다 - useMemo 하나로 안정 참조를 뽑는다.
  const allStories = useMemo(
    () => (catalog.status === 'ready' ? catalog.stories : []),
    [catalog],
  );
  const availableCategories = useMemo(() => uniqueCategories(allStories), [allStories]);
  const storyById = useMemo(() => Object.fromEntries(allStories.map((s) => [s.storyId, s])), [allStories]);

  const readStoryIds = useMemo(() => {
    if (completions.status !== 'ready') return new Set<string>();
    return new Set(completions.completions.map((c) => c.storyId));
  }, [completions]);

  const bookmarkedStoryIds = useMemo(
    () => new Set(bookmarks.bookmarks.map((b) => b.storyId)),
    [bookmarks],
  );

  const filtered = useMemo(() => {
    return applyFilters(pickForTab({ tab, allStories, readStoryIds, bookmarkedStoryIds, progress, storyById }), query, category);
  }, [tab, allStories, readStoryIds, bookmarkedStoryIds, progress, storyById, query, category]);

  // 탭 라벨 옆 개수 뱃지용 - 각 탭의 "필터 이전" 총 개수. 검색/카테고리 필터는 뱃지 카운트에
  // 반영하지 않는다: 뱃지는 "이 탭에 총 얼마나 있는가"를 알려 주는 지표이지 현재 필터 결과
  // 크기가 아니다.
  const tabCounts = useMemo<Record<Tab, number>>(() => ({
    all: allStories.length,
    'in-progress': pickForTab({ tab: 'in-progress', allStories, readStoryIds, bookmarkedStoryIds, progress, storyById }).length,
    read: readStoryIds.size,
    saved: bookmarkedStoryIds.size,
  }), [allStories, readStoryIds, bookmarkedStoryIds, progress, storyById]);

  const clearFilters = () => { setQuery(''); setCategory(null); };
  const goToAll = () => setTab('all');

  if (state.status !== 'authenticated') return null;

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, 'library')} onBack={() => navigate('/parent')}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">서재</Text>

        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="이야기 제목이나 설명을 검색해요"
          accessibilityLabel="이야기 검색"
        />

        {availableCategories.length > 0 ? (
          <View style={styles.categoryRow}>
            <FilterChip label="전체" selected={category === null} onPress={() => setCategory(null)} />
            {availableCategories.map((cat) => (
              <FilterChip
                key={cat}
                label={cat}
                selected={category === cat}
                onPress={() => setCategory(cat === category ? null : cat)}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.tabRow}>
          {TABS.map((entry) => (
            <FilterChip
              key={entry.key}
              accessibilityRole="tab"
              tone="filled"
              label={entry.label}
              selected={entry.key === tab}
              onPress={() => setTab(entry.key)}
              count={tabCounts[entry.key]}
            />
          ))}
        </View>

        {catalog.status === 'loading' ? (
          <View style={styles.centerBox}><ActivityIndicator color={storybookTheme.color.primary} /></View>
        ) : catalog.status === 'error' ? (
          <Card variant="panel" padding="md" title="이야기를 불러오지 못했어요">
            <Text style={styles.stubBody}>{catalog.message}</Text>
          </Card>
        ) : filtered.length === 0 ? (
          <EmptyForTab
            tab={tab}
            query={query}
            category={category}
            onClearFilters={clearFilters}
            onGoToAll={goToAll}
          />
        ) : (
          <View style={styles.grid}>
            {filtered.map((story) => (
              <View key={story.storyId} style={[styles.cardSlot, { width: `${100 / columns}%` }]}>
                <StoryCardWithFallback
                  story={story}
                  auth={state}
                  navigate={navigate}
                  progress={progress}
                  onUnbookmark={tab === 'saved' ? () => bookmarks.toggle(story.storyId) : undefined}
                />
              </View>
            ))}
          </View>
        )}
      </View>
    </AppNavShell>
  );
}

/* -------------------------------------------------------------- inner UI */

function StoryCardWithFallback({
  story,
  auth,
  navigate,
  progress,
  onUnbookmark,
}: {
  story: StoryCatalogEntry;
  auth: AuthState;
  navigate: (path: string) => void;
  progress: LocalStoryProgress | null;
  onUnbookmark?: () => void;
}) {
  const locked = unlockStateFor(story, auth) === 'locked';
  const isInProgress = progress?.storyId === story.storyId;
  const progressRatio = isInProgress ? Math.min(0.95, Math.max(0.05, (progress?.elapsedSeconds ?? 0) / (12 * 60))) : undefined;
  return (
    <StoryCard
      title={story.title}
      coverImageUrl={story.coverImageUrl}
      description={story.description}
      category={story.category}
      locked={locked}
      progress={progressRatio}
      lockedCaption={locked ? '구독하고 잠금 해제' : undefined}
      onRemove={onUnbookmark}
      removeLabel={onUnbookmark ? `${story.title} 저장 해제` : undefined}
      onPress={() => {
        if (locked) {
          navigate('/mypage/subscription');
          return;
        }
        if (story.storyId === DEFAULT_BETA_STORY_ID) {
          navigate('/demo');
          return;
        }
        navigate(`/stories/${story.storyId}`);
      }}
    />
  );
}

function EmptyForTab({
  tab,
  query,
  category,
  onClearFilters,
  onGoToAll,
}: {
  tab: Tab;
  query: string;
  category: string | null;
  onClearFilters: () => void;
  onGoToAll: () => void;
}) {
  const filtered = query.trim().length > 0 || category !== null;
  const caption =
    filtered ? '검색·필터에 맞는 이야기가 없어요. 다른 조건으로 다시 찾아보세요.' :
    tab === 'in-progress' ? '읽는 중인 이야기가 없어요. 이야기 하나를 골라 시작해 보세요.' :
    tab === 'read' ? '아직 끝까지 읽은 이야기가 없어요.' :
    tab === 'saved' ? '저장한 이야기가 없어요. 마음에 드는 작품 상세에서 “저장하기”를 눌러 담아 보세요.' :
    '이야기가 없어요.';
  // 필터가 걸린 상태의 empty는 "필터 해제"만 있으면 다음 행동이 분명하다. 필터 없는 상태의
  // 빈 서브탭(읽는 중/읽은/저장한)에서는 '전체' 탭이 항상 채워져 있으므로 그곳으로 유도한다.
  // '전체'가 완전히 비어 있는 상황은 카탈로그 자체가 비어야 발생하는데, 그때는 CTA가 의미
  // 없으므로 caption만 보여준다.
  const showClearFilters = filtered;
  const showGoToAll = !filtered && tab !== 'all';
  return (
    <Card variant="panel" padding="md" style={styles.emptyCard}>
      <Text style={styles.stubBody}>{caption}</Text>
      {showClearFilters ? (
        <ActionButton variant="secondaryFull" label="필터 해제" onPress={onClearFilters} />
      ) : showGoToAll ? (
        <ActionButton variant="secondaryFull" label="전체 이야기 보기" onPress={onGoToAll} />
      ) : null}
    </Card>
  );
}

/* -------------------------------------------------------------- helpers */

function uniqueCategories(stories: StoryCatalogEntry[]): string[] {
  const set = new Set<string>();
  for (const story of stories) if (story.category) set.add(story.category);
  return Array.from(set).sort();
}

function pickForTab({
  tab,
  allStories,
  readStoryIds,
  bookmarkedStoryIds,
  progress,
  storyById,
}: {
  tab: Tab;
  allStories: StoryCatalogEntry[];
  readStoryIds: Set<string>;
  bookmarkedStoryIds: Set<string>;
  progress: LocalStoryProgress | null;
  storyById: Record<string, StoryCatalogEntry>;
}): StoryCatalogEntry[] {
  switch (tab) {
    case 'in-progress':
      // 현재 브라우저의 진행 세션은 최대 1개 - 있으면 그 이야기를 보여주고, 없으면 빈 리스트.
      if (!progress) return [];
      return storyById[progress.storyId] ? [storyById[progress.storyId]] : [];
    case 'read':
      // 완료 기록의 storyId를 dedupe해 카탈로그와 join - 카탈로그에 없는 storyId는 조용히 필터.
      return Array.from(readStoryIds)
        .map((id) => storyById[id])
        .filter((story): story is StoryCatalogEntry => Boolean(story));
    case 'saved':
      return Array.from(bookmarkedStoryIds)
        .map((id) => storyById[id])
        .filter((story): story is StoryCatalogEntry => Boolean(story));
    case 'all':
    default:
      return allStories;
  }
}

function applyFilters(
  stories: StoryCatalogEntry[],
  query: string,
  category: string | null,
): StoryCatalogEntry[] {
  const normalized = query.trim().toLowerCase();
  return stories.filter((story) => {
    if (category && story.category !== category) return false;
    if (!normalized) return true;
    const hay = `${story.title} ${story.description ?? ''} ${story.category ?? ''}`.toLowerCase();
    return hay.includes(normalized);
  });
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    width: '100%',
    maxWidth: storybookTheme.layout.wideMaxWidth,
    alignSelf: 'center',
    gap: 16,
    paddingHorizontal: storybookTheme.spacing.ml,
    paddingTop: storybookTheme.spacing.lg,
    paddingBottom: storybookTheme.spacing.xl,
  },
  title: {
    fontSize: storybookTheme.type.xl,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onContent,
  },
  categoryRow: { flexDirection: 'row', gap: storybookTheme.spacing.xs, flexWrap: 'wrap' },
  tabRow: { flexDirection: 'row', gap: storybookTheme.spacing.sm, flexWrap: 'wrap' },
  centerBox: { alignItems: 'center', paddingVertical: storybookTheme.spacing.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cardSlot: { padding: storybookTheme.spacing.sm },
  stubBody: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onContentMuted,
  },
  // 빈 상태 카드 - 텍스트 아래 CTA 버튼 사이에 여유 확보.
  emptyCard: { gap: storybookTheme.spacing.ms },
});
