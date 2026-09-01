import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { AppNavShell, SearchField, StoryCard, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, useAuth, type AuthState } from '@/entities/auth';
import {
  DEFAULT_BETA_STORY_ID,
  listStories,
  unlockStateFor,
  type StoryCatalogEntry,
} from '@/entities/story';
import { useBookmarks } from '@/entities/bookmark';
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
        const message = failure instanceof Error ? failure.message : '이야기 목록을 불러오지 못했어요.';
        setCatalog({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state.status !== 'authenticated') return;
    let cancelled = false;
    listStoryCompletions(state.token)
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
  }, [state]);

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
            <CategoryChip label="전체" selected={category === null} onPress={() => setCategory(null)} />
            {availableCategories.map((cat) => (
              <CategoryChip
                key={cat}
                label={cat}
                selected={category === cat}
                onPress={() => setCategory(cat === category ? null : cat)}
              />
            ))}
          </View>
        ) : null}

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

        {catalog.status === 'loading' ? (
          <View style={styles.centerBox}><ActivityIndicator color={storybookTheme.color.gold} /></View>
        ) : catalog.status === 'error' ? (
          <View style={styles.stubPanel}>
            <Text style={styles.stubTitle}>이야기를 불러오지 못했어요</Text>
            <Text style={styles.stubBody}>{catalog.message}</Text>
          </View>
        ) : filtered.length === 0 ? (
          <EmptyForTab tab={tab} query={query} category={category} />
        ) : (
          <View style={styles.grid}>
            {filtered.map((story) => (
              <View key={story.storyId} style={[styles.cardSlot, { width: `${100 / columns}%` }]}>
                <StoryCardWithFallback story={story} auth={state} navigate={navigate} progress={progress} />
              </View>
            ))}
          </View>
        )}
      </View>
    </AppNavShell>
  );
}

/* -------------------------------------------------------------- inner UI */

function CategoryChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.categoryChip, selected && styles.categoryChipActive, pressed && styles.pressed]}
    >
      <Text style={[styles.categoryChipLabel, selected && styles.categoryChipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function StoryCardWithFallback({
  story,
  auth,
  navigate,
  progress,
}: {
  story: StoryCatalogEntry;
  auth: AuthState;
  navigate: (path: string) => void;
  progress: LocalStoryProgress | null;
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

function EmptyForTab({ tab, query, category }: { tab: Tab; query: string; category: string | null }) {
  const filtered = query.trim().length > 0 || category !== null;
  const caption =
    filtered ? '검색·필터에 맞는 이야기가 없어요. 다른 조건으로 다시 찾아보세요.' :
    tab === 'in-progress' ? '읽는 중인 이야기가 없어요. 이야기 하나를 골라 시작해 보세요.' :
    tab === 'read' ? '아직 끝까지 읽은 이야기가 없어요.' :
    tab === 'saved' ? '저장한 이야기가 없어요. 마음에 드는 작품 상세에서 “저장하기”를 눌러 담아 보세요.' :
    '이야기가 없어요.';
  return (
    <View style={styles.stubPanel}>
      <Text style={styles.stubBody}>{caption}</Text>
    </View>
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
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  title: {
    fontSize: storybookTheme.type.xl,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onDark,
  },
  categoryRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: storybookTheme.radius.pill,
    borderWidth: 1,
    borderColor: storybookTheme.color.panelOnDarkBorder,
  },
  categoryChipActive: {
    backgroundColor: storybookTheme.color.panelOnDarkBackground,
    borderColor: storybookTheme.color.gold,
  },
  categoryChipLabel: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.semibold,
    color: storybookTheme.color.onDarkMuted,
  },
  categoryChipLabelActive: { color: storybookTheme.color.gold },
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
  centerBox: { alignItems: 'center', paddingVertical: 32 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cardSlot: { padding: 8 },
  stubPanel: {
    backgroundColor: storybookTheme.color.panelOnDarkBackground,
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    borderColor: storybookTheme.color.panelOnDarkBorder,
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 6,
  },
  stubTitle: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.gold,
  },
  stubBody: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onDarkMuted,
  },
});
