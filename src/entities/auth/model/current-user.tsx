import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { clearLocalStoryProgress, setBetaEventAuthToken, setLocalProgressOwner } from '@/entities/analytics';
import { setRequestAuthToken } from '@/shared/api';

import { fetchCurrentUser, type UserSummary } from '../api/auth-api';
import { clearStoredToken, getStoredToken, storeToken } from './session';

export type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; token: string; user: UserSummary };

type AuthContextValue = {
  state: AuthState;
  /** 로그인/회원가입/가입(join) 응답이 성공한 뒤 호출한다 - 토큰을 저장하고 `user`를 새로고침한다. */
  setSession: (token: string, user: UserSummary) => void;
  logout: () => void;
  refresh: () => Promise<void>;
  /** 프로필 저장(updateProfile) 성공 직후 호출한다 - refresh()의 전체 왕복 없이 user만 교체한다. */
  updateUser: (user: UserSummary) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function resolveInitialAuthState(): Promise<AuthState> {
  const token = getStoredToken();
  if (!token) {
    setLocalProgressOwner(null);
    return { status: 'anonymous' };
  }
  try {
    const user = await fetchCurrentUser(token);
    setLocalProgressOwner(user.id);
    return { status: 'authenticated', token, user };
  } catch {
    // 토큰이 만료/무효화된 경우 - 재로그인하도록 익명 상태로 되돌린다 (이번 phase엔 리프레시 토큰 없음).
    clearStoredToken();
    setLocalProgressOwner(null);
    return { status: 'anonymous' };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    resolveInitialAuthState().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setSession = useCallback((token: string, user: UserSummary) => {
    storeToken(token);
    setLocalProgressOwner(user.id);
    setState({ status: 'authenticated', token, user });
  }, []);

  const logout = useCallback(() => {
    // 같은 기기의 다음 사용자에게 이어 읽기 기록이 보이지 않게 이 계정의 진행을 지운다(선택 아이는 ChildrenProvider가 지운다).
    clearLocalStoryProgress();
    setLocalProgressOwner(null);
    clearStoredToken();
    setState({ status: 'anonymous' });
  }, []);

  const refresh = useCallback(async () => {
    setState(await resolveInitialAuthState());
  }, []);

  const updateUser = useCallback((user: UserSummary) => {
    setState((prev) => (prev.status === 'authenticated' ? { ...prev, user } : prev));
  }, []);

  // 로그인 상태면 통계 이벤트에 토큰을 실어 그 통계 세션을 계정에 연결하고(Q-40 UT),
  // 이야기 요청에도 실어 이용권이 필요한 이야기를 막지 않게 한다(Q-33).
  const authToken = state.status === 'authenticated' ? state.token : null;
  // layout effect - 자식 화면의 요청 effect보다 먼저 돌아야 로그인 직후 첫 요청에도 토큰이 실린다.
  useLayoutEffect(() => {
    setBetaEventAuthToken(authToken);
    setRequestAuthToken(authToken);
  }, [authToken]);

  const value = useMemo(
    () => ({ state, setSession, logout, refresh, updateUser }),
    [state, setSession, logout, refresh, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
