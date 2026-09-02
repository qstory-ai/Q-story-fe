import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { AppNavShell, SearchField, StoryCard, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { dashboardNavItems, useAuth, type AuthState } from '@/entities/auth';
import {
  DEFAULT_BETA_STORY_ID,
  listStories,
  unlockStateFor,
  type StoryCatalogEntry,
} from '@/entities/story';
import { useBookmarks } from '@/entities/bookmark';
import { listStoryCompletions, type StoryCompletionSummary } from '@/entities/story-completion';

type Tab = 'all' | 'saved' | 'recent';
type CatalogLoad = { status: 'loading' } | { status: 'ready'; stories: StoryCatalogEntry[] } | { status: 'error'; message: string };
type CompletionsLoad = { status: 'loading' } | { status: 'ready'; completions: StoryCompletionSummary[] } | { status: 'error' };

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: '전체 작품' },
  { key: 'saved', label: '저장한 작품' },
  { key: 'recent', label: '최근 본 작품' },
];

/**
 * IA 선생님용 "[2] 서재" 화면. 부모 LibraryPage와 구조는 같지만 서브탭이 세 개다:
 *   - 전체: 카탈로그 전체
 *   - 저장한 작품: useBookmarks() (부모와 같은 저장소를 공유하지만 계정 단위라 결과는 다름)
 *   - 최근 본 작품: IA 팀 논의 결과 "수업에 사용한 기록 기준" - story-completion을 dedupe해 사용.
 *     열람 기준으로 하면 세션마다 서버 요청이 필요해 편의성 대비 비용이 커서 이 방식.
 */
export function TutorLibraryPage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const { width } = useWindowDimensions();
  const columns = width >= 860 ? 3 : width >= 520 ? 2 : 1;
  const bookmarks = useBookmarks();

  const [catalog, setCatalog] = useState<CatalogLoad>({ status: 'loading' });
  const [completions, setCompletions] = useState<CompletionsLoad>({ status: 'loading' });
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'TUTOR') {
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
    listStoryCompletions(state.token)
      .then((list) => {
        if (!cancelled) setCompletions({ status: 'ready', completions: list });
      })
      .catch(() => {
        if (!cancelled) setCompletions({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [state]);

  // catalog.status 분기가 매 렌더마다 새 빈 배열을 만들지 않도록 안정 참조로 뽑는다 -
  // useMemo dep가 흔들리면 아래 여러 파생값이 매번 다시 계산된다.
  const allStories = useMemo(
    () => (catalog.status === 'ready' ? catalog.stories : []),
    [catalog],
  );
  const availableCategories = useMemo(() => uniqueCategories(allStories), [allStories]);
  const storyById = useMemo(() => Object.fromEntries(allStories.map((s) => [s.storyId, s])), [allStories]);

  const bookmarkedIds = useMemo(() => new Set(bookmarks.bookmarks.map((b) => b.storyId)), [bookmarks]);
  const recentIds = useMemo(() => {
    if (completions.status !== 'ready') return [] as string[];
    // 완료 기록을 최신순으로 정렬해 dedupe하되 첫 등장 순서를 유지 - "가장 최근에 본" 순서.
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const completion of [...completions.completions].sort((a, b) => (b.completedAt > a.completedAt ? 1 : -1))) {
      if (seen.has(completion.storyId)) continue;
      seen.add(completion.storyId);
      ordered.push(completion.storyId);
    }
    return ordered;
  }, [completions]);

  const filtered = useMemo(
    () => applyFilters(pickForTab({ tab, allStories, bookmarkedIds, recentIds, storyById }), query, category),
    [tab, allStories, bookmarkedIds, recentIds, storyById, query, category],
  );

  if (state.status !== 'authenticated') return null;

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, 'library')} onBack={() => navigate('/tutor')}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">서재</Text>
        <Text style={styles.subtitle}>다음 수업에 어떤 이야기를 쓸지 미리 살펴보고, 학생별로 담아 두세요.</Text>

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
                <StoryCardWithLink story={story} auth={state} navigate={navigate} />
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

function StoryCardWithLink({
  story,
  auth,
  navigate,
}: {
  story: StoryCatalogEntry;
  auth: AuthState;
  navigate: (path: string) => void;
}) {
  const locked = unlockStateFor(story, auth) === 'locked';
  return (
    <StoryCard
      title={story.title}
      coverImageUrl={story.coverImageUrl}
      description={story.description}
      category={story.category}
      locked={locked}
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
    filtered ? '검색·필터에 맞는 이야기가 없어요.' :
    tab === 'saved' ? '저장한 이야기가 없어요. 마음에 드는 작품 상세에서 “저장하기”를 눌러 담아 보세요.' :
    tab === 'recent' ? '최근에 사용한 이야기가 없어요. 학생과 함께 이야기를 진행하면 여기에 쌓여요.' :
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
  bookmarkedIds,
  recentIds,
  storyById,
}: {
  tab: Tab;
  allStories: StoryCatalogEntry[];
  bookmarkedIds: Set<string>;
  recentIds: string[];
  storyById: Record<string, StoryCatalogEntry>;
}): StoryCatalogEntry[] {
  switch (tab) {
    case 'saved':
      return Array.from(bookmarkedIds)
        .map((id) => storyById[id])
        .filter((story): story is StoryCatalogEntry => Boolean(story));
    case 'recent':
      return recentIds
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
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  title: {
    fontSize: storybookTheme.type.xl,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onDark,
  },
  subtitle: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.onDarkMuted,
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
