import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

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
  if (!token) return { status: 'anonymous' };
  try {
    const user = await fetchCurrentUser(token);
    return { status: 'authenticated', token, user };
  } catch {
    // 토큰이 만료/무효화된 경우 - 재로그인하도록 익명 상태로 되돌린다 (이번 phase엔 리프레시 토큰 없음).
    clearStoredToken();
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
    setState({ status: 'authenticated', token, user });
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    setState({ status: 'anonymous' });
  }, []);

  const refresh = useCallback(async () => {
    setState(await resolveInitialAuthState());
  }, []);

  const updateUser = useCallback((user: UserSummary) => {
    setState((prev) => (prev.status === 'authenticated' ? { ...prev, user } : prev));
  }, []);

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
