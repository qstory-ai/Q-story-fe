import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { migrateLegacyProgress } from '@/entities/analytics';
import { useAuth } from '@/entities/auth';
import {
  listChildren,
  createChild as apiCreateChild,
  updateChild as apiUpdateChild,
  deleteChild as apiDeleteChild,
  type AgeBand,
  type Child,
  type CreateChildInput,
  type UpdateChildInput,
} from '../api/child-api';
import { CHILD_AVATARS } from './avatars';

const SELECTED_CHILD_STORAGE_KEY = 'qstory.parent.selectedChildId';
const BACKFILLED_MARK_KEY = 'qstory.parent.childBackfillDone';

type LoadState = { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

export type ChildrenContextValue = {
  load: LoadState;
  children: Child[];
  selectedChild: Child | null;
  selectChild: (childId: string) => void;
  addChild: (input: CreateChildInput) => Promise<Child>;
  editChild: (childId: string, input: UpdateChildInput) => Promise<Child>;
  removeChild: (childId: string) => Promise<void>;
  reload: () => Promise<void>;
};

const ChildrenContext = createContext<ChildrenContextValue | null>(null);

function readStoredSelectedId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(SELECTED_CHILD_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredSelectedId(id: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (id === null) window.localStorage.removeItem(SELECTED_CHILD_STORAGE_KEY);
    else window.localStorage.setItem(SELECTED_CHILD_STORAGE_KEY, id);
  } catch {
    // 프라이빗 모드 등에서 실패해도 앱 흐름을 막지 않는다 - 기본 아이가 선택될 뿐이다.
  }
}

function alreadyBackfilled(userId: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(`${BACKFILLED_MARK_KEY}.${userId}`) === '1';
  } catch {
    return true;
  }
}

function markBackfilled(userId: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${BACKFILLED_MARK_KEY}.${userId}`, '1');
  } catch {
    // 위와 동일 - 실패해도 다음 로그인 때 한 번 더 시도하게 될 뿐 큰 문제 없다.
  }
}

/**
 * PARENT로 로그인한 순간부터 아이 목록을 캐싱/편집/선택 상태 유지까지 담당한다 - 부모 홈의
 * 여러 섹션(추천/이어서/새/최근)이 각자 API를 다시 호출하지 않아도 되도록 한 컨텍스트에
 * 모았다. AuthProvider와 같은 패턴(loading/authenticated 분리)이라 위쪽에서 얇게 감싼다.
 *
 * <p>기존 계정(user.childName만 있고 아직 children[]이 비어 있는 부모)은 첫 로드에서 한 번만
 * 자동 백필된다 - localStorage에 완료 표시를 남기므로 사용자가 이후 아이를 지워도 다시
 * 되살아나지 않는다. 새로 가입한 부모는 childName이 없어서 아무 일도 일어나지 않는다.
 */
export function ChildrenProvider({ children: node }: { children: ReactNode }) {
  const { state, verified, updateUser } = useAuth();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(() => readStoredSelectedId());

  const isParent = state.status === 'authenticated' && state.user.role === 'PARENT';
  const token = state.status === 'authenticated' ? state.token : null;
  const parentUserId = state.status === 'authenticated' ? state.user.id : null;
  // 로그아웃(로그인 → 없음)하면 선택해 둔 아이를 지운다 - 같은 기기의 다음 사용자에게 이어지지 않게.
  const [lastUserId, setLastUserId] = useState<string | null>(parentUserId);
  if (lastUserId !== parentUserId) {
    setLastUserId(parentUserId);
    if (parentUserId === null && lastUserId !== null) {
      setSelectedId(null);
      writeStoredSelectedId(null);
    }
  }
  const legacyChildName = state.status === 'authenticated' ? state.user.childName : null;

  useEffect(() => {
    if (!isParent || !token || !parentUserId) {
      // 부모가 아니면 여기서 반환 - 관련 상태 정리는 effectiveLoad/effectiveChildren이
      // 파생값으로 처리하므로 setState를 부를 필요가 없다.
      return;
    }
    let cancelled = false;
    listChildren(token)
      .then((next) => {
        if (cancelled) return;
        // 예전 공용 키의 이어 읽기 기록은 이 계정의 아이 것일 때만 계정 키로 옮기고, 아니면 버린다(children 갱신 전에 처리).
        migrateLegacyProgress(parentUserId, next.map((child) => child.id));
        setChildren(next);
        setLoad({ status: 'ready' });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : '아이 목록을 불러오지 못했어요.';
        setLoad({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [isParent, token, parentUserId]);

  // 처음 온 기존 부모: user.childName 하나를 첫 아이로 승격한다. 아이 목록은 `/v1/auth/me` 확인과 동시에 받으므로
  // (저장된 사용자 요약에는 childName이 없다) 승격 여부는 확인이 끝난 뒤 정한다. 그 사이 빈 목록을 "아이 없음"으로
  // 보여 주지 않게 load를 loading으로 둔다.
  const [backfillFailedFor, setBackfillFailedFor] = useState<string | null>(null);
  const backfillCandidate =
    isParent &&
    !!parentUserId &&
    load.status === 'ready' &&
    children.length === 0 &&
    backfillFailedFor !== parentUserId &&
    !alreadyBackfilled(parentUserId);
  const backfillPending = backfillCandidate && (!verified || !!legacyChildName);

  // 부모가 아니거나 로그인 전이면 이 컨텍스트는 아무 것도 로드하지 않는다 - 그 상태에서
  // "load.status는 무엇이어야 하는가"는 내부 상태가 아니라 순수 파생값이므로 여기서 계산한다.
  // (useMemo로 안정 참조를 유지해 아래 컨텍스트 value가 매 렌더마다 새로 만들어지지 않게.)
  const effectiveLoad = useMemo<LoadState>(
    () => (isParent ? (backfillPending ? { status: 'loading' } : load) : state.status === 'loading' ? { status: 'loading' } : { status: 'ready' }),
    [isParent, backfillPending, load, state.status],
  );

  // 한 계정에 한 번만 보낸다(개발 모드 StrictMode의 effect 재실행·토큰 연장으로 deps가 바뀌어도 아이가 둘 생기지 않게).
  const backfillStartedForRef = useRef<string | null>(null);
  const currentUserIdRef = useRef(parentUserId);
  useEffect(() => {
    currentUserIdRef.current = parentUserId;
  }, [parentUserId]);
  useEffect(() => {
    if (!backfillCandidate || !verified || !legacyChildName || !token || !parentUserId) return;
    if (backfillStartedForRef.current === parentUserId) return;
    backfillStartedForRef.current = parentUserId;
    // 아바타는 프리셋 첫 번째로, 연령대는 유일하게 안전한 기본값('6-7')으로 채우고 사용자가 프로필에서 바꿀 수 있게 한다.
    apiCreateChild(token, {
      name: legacyChildName.trim().slice(0, 40),
      ageBand: '6-7',
      avatarKey: CHILD_AVATARS[0].key,
    })
      .then(() => {
        markBackfilled(parentUserId);
        return listChildren(token);
      })
      .then((next) => {
        // 그 사이 로그아웃·다른 계정 로그인이 있었으면 버린다.
        if (currentUserIdRef.current !== parentUserId) return;
        migrateLegacyProgress(parentUserId, next.map((child) => child.id));
        setChildren(next);
      })
      .catch(() => {
        // 백필 실패는 치명적이지 않다 - 사용자가 직접 "아이 추가"할 수 있게 두고, 다음 방문에 재시도.
        if (currentUserIdRef.current === parentUserId) setBackfillFailedFor(parentUserId);
      })
      .finally(() => {
        backfillStartedForRef.current = null;
      });
  }, [backfillCandidate, verified, legacyChildName, token, parentUserId]);

  const selectChild = useCallback((childId: string) => {
    setSelectedId(childId);
    writeStoredSelectedId(childId);
  }, []);

  const reload = useCallback(async () => {
    if (!token || !parentUserId) return;
    setLoad({ status: 'loading' });
    try {
      const next = await listChildren(token);
      setChildren(next);
      setLoad({ status: 'ready' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '아이 목록을 불러오지 못했어요.';
      setLoad({ status: 'error', message });
    }
  }, [token, parentUserId]);

  const addChild = useCallback(
    async (input: CreateChildInput): Promise<Child> => {
      if (!token) throw new Error('로그인이 필요해요.');
      const created = await apiCreateChild(token, input);
      // childName 백필 부작용 방지: 첫 아이가 만들어졌으니 이 계정은 백필 대상이 아님으로 표시.
      if (parentUserId) markBackfilled(parentUserId);
      // 새로 만든 아이를 곧바로 선택한다.
      setChildren((prev) => [...prev, created]);
      if (state.status === 'authenticated' && !state.user.childName) {
        // childName이 비어 있던 계정에는 첫 아이 이름을 childName에도 반영 - 리포트 카피 등에서
        // 아직 user.childName을 쓴다.
        updateUser({ ...state.user, childName: created.name });
      }
      selectChild(created.id);
      return created;
    },
    [token, parentUserId, state, selectChild, updateUser],
  );

  const editChild = useCallback(
    async (childId: string, input: UpdateChildInput): Promise<Child> => {
      if (!token) throw new Error('로그인이 필요해요.');
      const updated = await apiUpdateChild(token, childId, input);
      setChildren((prev) => prev.map((child) => (child.id === childId ? updated : child)));
      return updated;
    },
    [token],
  );

  const removeChild = useCallback(
    async (childId: string): Promise<void> => {
      if (!token) throw new Error('로그인이 필요해요.');
      await apiDeleteChild(token, childId);
      setChildren((prev) => prev.filter((child) => child.id !== childId));
      if (selectedId === childId) {
        // 선택을 비우면 value 계산에서 첫 아이가 자동 선택된다.
        setSelectedId(null);
        writeStoredSelectedId(null);
      }
    },
    [token, selectedId],
  );

  const value = useMemo<ChildrenContextValue>(() => {
    const exposedChildren = isParent ? children : [];
    // 저장된 selectedId가 목록에 없으면(아이가 삭제됐거나 아직 명시적으로 고르지 않았거나)
    // 첫 아이를 자동 선택으로 보여준다 - 상태에 다시 쓰지 않고 순수 파생값으로 처리한다.
    const selectedChild = exposedChildren.length === 0
      ? null
      : exposedChildren.find((child) => child.id === selectedId) ?? exposedChildren[0];
    return {
      load: effectiveLoad,
      children: exposedChildren,
      selectedChild,
      selectChild,
      addChild,
      editChild,
      removeChild,
      reload,
    };
  }, [isParent, effectiveLoad, children, selectedId, selectChild, addChild, editChild, removeChild, reload]);

  return <ChildrenContext.Provider value={value}>{node}</ChildrenContext.Provider>;
}

export function useChildren(): ChildrenContextValue {
  const context = useContext(ChildrenContext);
  if (!context) {
    throw new Error('useChildren must be used within a ChildrenProvider');
  }
  return context;
}

export type { AgeBand, Child, CreateChildInput, UpdateChildInput };
