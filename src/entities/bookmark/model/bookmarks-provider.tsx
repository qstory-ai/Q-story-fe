import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useAuth } from '@/entities/auth';
import {
  createBookmark,
  listBookmarks,
  removeBookmark,
  type Bookmark,
} from '../api/bookmark-api';

type LoadState = { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

export type BookmarksContextValue = {
  load: LoadState;
  bookmarks: Bookmark[];
  /** storyId가 이미 저장된 상태인지 - 서재/작품 상세 페이지의 아이콘 상태 표시에 쓴다. */
  isBookmarked: (storyId: string) => boolean;
  /** 저장/해제 토글 - 낙관적 UI로 즉시 반영하고, 실패 시 원래 상태로 되돌린다. */
  toggle: (storyId: string) => Promise<void>;
  reload: () => Promise<void>;
};

const BookmarksContext = createContext<BookmarksContextValue | null>(null);

/**
 * 로그인된 사용자의 북마크 목록을 캐싱한다. 서재 페이지의 "저장한 작품" 서브탭과 작품 상세의
 * 저장하기 토글이 이 컨텍스트를 공유하므로, 어느 한쪽에서 저장을 바꾸면 다른 쪽이 자동으로
 * 반영된다. 비로그인/anonymous 상태에서도 provider 자체는 마운트돼 있지만 목록은 항상 빈 배열
 * 이고 toggle은 예외를 던진다.
 */
export function BookmarksProvider({ children: node }: { children: ReactNode }) {
  const { state } = useAuth();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  const token = state.status === 'authenticated' ? state.token : null;
  const userId = state.status === 'authenticated' ? state.user.id : null;

  const effectiveLoad = useMemo<LoadState>(
    () => (token ? load : state.status === 'loading' ? { status: 'loading' } : { status: 'ready' }),
    [token, load, state.status],
  );

  useEffect(() => {
    if (!token || !userId) return;
    let cancelled = false;
    listBookmarks(token)
      .then((next) => {
        if (cancelled) return;
        setBookmarks(next);
        setLoad({ status: 'ready' });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : '저장한 작품을 불러오지 못했어요.';
        setLoad({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [token, userId]);

  const isBookmarked = useCallback(
    (storyId: string) => bookmarks.some((bookmark) => bookmark.storyId === storyId),
    [bookmarks],
  );

  const toggle = useCallback(
    async (storyId: string) => {
      if (!token) throw new Error('로그인이 필요해요.');
      const existing = bookmarks.find((bookmark) => bookmark.storyId === storyId);
      if (existing) {
        // 낙관적 삭제 - 실패 시 되살린다.
        setBookmarks((prev) => prev.filter((bookmark) => bookmark.id !== existing.id));
        try {
          await removeBookmark(token, storyId);
        } catch (error) {
          setBookmarks((prev) => [existing, ...prev]);
          throw error;
        }
      } else {
        // 낙관적 추가 - 서버 응답이 오면 임시 항목을 실제 것으로 교체한다. 임시 id는 절대 서버가
        // 발급한 UUID와 겹치지 않을 접두사를 쓴다.
        const optimistic: Bookmark = {
          id: `optimistic-${storyId}-${Date.now()}`,
          storyId,
          createdAt: new Date().toISOString(),
        };
        setBookmarks((prev) => [optimistic, ...prev]);
        try {
          const created = await createBookmark(token, storyId);
          setBookmarks((prev) => [created, ...prev.filter((bookmark) => bookmark.id !== optimistic.id)]);
        } catch (error) {
          setBookmarks((prev) => prev.filter((bookmark) => bookmark.id !== optimistic.id));
          throw error;
        }
      }
    },
    [token, bookmarks],
  );

  const reload = useCallback(async () => {
    if (!token) return;
    setLoad({ status: 'loading' });
    try {
      const next = await listBookmarks(token);
      setBookmarks(next);
      setLoad({ status: 'ready' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '저장한 작품을 불러오지 못했어요.';
      setLoad({ status: 'error', message });
    }
  }, [token]);

  const value = useMemo<BookmarksContextValue>(() => {
    const exposedBookmarks = token ? bookmarks : [];
    return { load: effectiveLoad, bookmarks: exposedBookmarks, isBookmarked, toggle, reload };
  }, [token, effectiveLoad, bookmarks, isBookmarked, toggle, reload]);

  return <BookmarksContext.Provider value={value}>{node}</BookmarksContext.Provider>;
}

export function useBookmarks(): BookmarksContextValue {
  const context = useContext(BookmarksContext);
  if (!context) {
    throw new Error('useBookmarks must be used within a BookmarksProvider');
  }
  return context;
}
