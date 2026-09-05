import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { SectionHeader, StoryCard, storybookTheme } from '@/shared/ui';
import { useAuth, type AuthState } from '@/entities/auth';
import {
  DEFAULT_BETA_STORY_ID,
  StoryApiError,
  listStories,
  unlockStateFor,
  type StoryCatalogEntry,
} from '@/entities/story';

type LoadState = { status: 'loading' } | { status: 'ready'; stories: StoryCatalogEntry[] } | { status: 'error' };

/** 한 페이지에 보여줄 카드 수 - 화면 너비와 무관하게 고정(그리드 열 수는 컬럼 계산이 알아서 접는다). */
const PAGE_SIZE = 3;

/**
 * 페이지가 많아지면 1 ... 현재-1 현재 현재+1 ... 마지막 형태로 줄인다 - 카탈로그가 지금은
 * 작지만(이야기 1편), 나중에 수십 편으로 늘어도 숫자 버튼이 한 줄을 넘기지 않게 해 둔다.
 */
function pageWindow(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages: (number | 'ellipsis')[] = [1];
  if (current > 3) pages.push('ellipsis');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (current < total - 2) pages.push('ellipsis');
  pages.push(total);
  return pages;
}

function PaginationBar({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <View style={styles.pagination} accessibilityRole="none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="이전 페이지"
        disabled={page === 1}
        onPress={() => onChange(page - 1)}
        style={[styles.pageArrow, page === 1 && styles.pageArrowDisabled]}
      >
        <Text style={styles.pageArrowText}>‹</Text>
      </Pressable>
      {pageWindow(page, totalPages).map((entry, index) =>
        entry === 'ellipsis' ? (
          <Text key={`ellipsis-${index}`} style={styles.pageEllipsis}>
            …
          </Text>
        ) : (
          <Pressable
            key={entry}
            accessibilityRole="button"
            accessibilityLabel={`${entry}페이지`}
            accessibilityState={{ selected: entry === page }}
            onPress={() => onChange(entry)}
            style={[styles.pageNumber, entry === page && styles.pageNumberActive]}
          >
            <Text style={[styles.pageNumberText, entry === page && styles.pageNumberTextActive]}>
              {entry}
            </Text>
          </Pressable>
        ),
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="다음 페이지"
        disabled={page === totalPages}
        onPress={() => onChange(page + 1)}
        style={[styles.pageArrow, page === totalPages && styles.pageArrowDisabled]}
      >
        <Text style={styles.pageArrowText}>›</Text>
      </Pressable>
    </View>
  );
}

function subtitleFor(auth: AuthState): string {
  if (auth.status === 'authenticated' && auth.user.grantsAccess) {
    return '모든 이야기가 열려 있어요.';
  }
  if (auth.status === 'authenticated') {
    return '구독하면 서재의 모든 이야기를 볼 수 있어요. 지금은 무료 데모 한 편을 먼저 만나보세요.';
  }
  return '무료 데모 한 편을 지금 바로 만나보세요. 로그인하면 서재가 더 넓어져요.';
}

/**
 * 홈("/")과 부모 홈("/parent")이 함께 쓰는 책장 그리드 - listStories()로 카탈로그를 가져와
 * unlockStateFor()로 카드마다 잠금 상태를 계산한다. 잠긴 카드도 눌리긴 하지만(비활성화하지
 * 않는다) 어디로 보낼지는 여기서 auth 상태를 보고 정한다: 비로그인이면 로그인 화면으로,
 * 로그인은 했지만 아직 결제 전이면 구독 안내가 있을 마이페이지로 - 실제 결제 플로우는 아직
 * 없어서(SubscriptionStatus.java 주석 참고) 지금은 그 임시 목적지가 최선이다.
 */
export function StoryLibraryGrid() {
  const navigate = useNavigate();
  const { state: auth } = useAuth();
  const { width } = useWindowDimensions();
  const columns = width >= 860 ? 3 : width >= 520 ? 2 : 1;
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    listStories()
      .then((stories) => {
        if (!cancelled) setLoad({ status: 'ready', stories });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        // 카탈로그 실패는 서재 전체를 막을 이유가 아니다 - 조용히 빈 상태로 접는다.
        setLoad({ status: 'error' });
        if (import.meta.env?.DEV) {
          const message = error instanceof StoryApiError ? error.message : String(error);
          console.warn('[StoryLibraryGrid] listStories failed:', message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // auth가 아직 'loading'이면 언락 여부를 확정할 수 없다 - 전부 잠긴 것처럼 그렸다가 한 박자
  // 뒤에 열리는 깜빡임을 피하려고, 카드 자체를 아직 그리지 않는다.
  if (load.status === 'loading' || auth.status === 'loading') {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator color={storybookTheme.color.primary} />
      </View>
    );
  }

  if (load.status === 'error' || load.stories.length === 0) {
    return null;
  }

  const goToLocked = () => {
    navigate(auth.status === 'authenticated' ? '/mypage' : '/login');
  };

  const totalPages = Math.max(1, Math.ceil(load.stories.length / PAGE_SIZE));
  // 카탈로그 길이가 줄어들어(필터링 등) 지금 페이지가 범위를 벗어나면 마지막 페이지로 붙인다.
  const currentPage = Math.min(page, totalPages);
  const pageStories = load.stories.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <View style={styles.section}>
      <SectionHeader title="우리 서재" subtitle={subtitleFor(auth)} />
      <View style={styles.grid}>
        {pageStories.map((story) => {
          const unlock = unlockStateFor(story, auth);
          const locked = unlock === 'locked';
          return (
            <View key={story.storyId} style={[styles.cardSlot, { width: `${100 / columns}%` }]}>
              <StoryCard
                title={story.title}
                coverImageUrl={story.coverImageUrl}
                description={story.description}
                category={story.category}
                locked={locked}
                lockedCaption={
                  locked ? (auth.status === 'authenticated' ? '구독하고 잠금 해제' : '로그인하고 잠금 해제') : undefined
                }
                onPress={() => {
                  if (locked) {
                    goToLocked();
                    return;
                  }
                  if (story.storyId === DEFAULT_BETA_STORY_ID) {
                    navigate('/demo');
                    return;
                  }
                  navigate(`/stories/${story.storyId}`);
                }}
              />
            </View>
          );
        })}
      </View>
      <PaginationBar page={currentPage} totalPages={totalPages} onChange={setPage} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
    maxWidth: storybookTheme.layout.wideMaxWidth,
    alignSelf: 'center',
    gap: 16,
  },
  centerBox: {
    width: '100%',
    paddingVertical: 32,
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cardSlot: {
    padding: 8,
  },
  pagination: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pageArrow: {
    minWidth: 40,
    minHeight: 40,
    borderRadius: storybookTheme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: storybookTheme.color.contentPanel,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentPanelBorder,
  },
  pageArrowDisabled: {
    opacity: 0.35,
  },
  pageArrowText: {
    color: storybookTheme.color.onContent,
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.bold,
    // 40x40 정원 안에서 화살표 문자가 수직 중앙에 정확히 오도록 lineHeight를 명시 잠금.
    lineHeight: 20,
  },
  pageNumber: {
    minWidth: 40,
    minHeight: 40,
    borderRadius: storybookTheme.radius.pill,
    // 두 자리 숫자를 담을 여유 - xs(4)/sm(8) 사이의 컴팩트 값 유지.
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pageNumberActive: {
    backgroundColor: storybookTheme.color.gold,
  },
  pageNumberText: {
    color: storybookTheme.color.onContentMuted,
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
  },
  pageNumberTextActive: {
    color: storybookTheme.color.primary,
  },
  pageEllipsis: {
    color: storybookTheme.color.onContentMuted,
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    paddingHorizontal: 2,
  },
});
