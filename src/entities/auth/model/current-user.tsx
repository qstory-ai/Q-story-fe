import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { clearLocalStoryProgress, setBetaEventAuthToken, setLocalProgressOwner } from '@/entities/analytics';
import { setRequestAuthToken } from '@/shared/api';

import { fetchCurrentUser, refreshToken, type AuthResponse, type UserSummary } from '../api/auth-api';
import { clearStoredToken, getStoredToken, storeToken, tokenIsExpired, tokenNeedsRenewal } from './session';

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

type BeforeLogoutHook = (token: string) => void;
const beforeLogoutHooks = new Set<BeforeLogoutHook>();

/**
 * 로그아웃 직전(저장된 토큰을 지우기 전)에 불릴 함수를 등록한다 - 그 토큰으로 서버에 정리 요청(예: 이 기기의
 * 푸시 토큰 해제)을 보내야 하는 기능용. 반환값으로 등록을 해제한다. hook은 동기로 불리니 요청은 띄워만 둔다.
 */
export function onBeforeLogout(hook: BeforeLogoutHook): () => void {
  beforeLogoutHooks.add(hook);
  return () => {
    beforeLogoutHooks.delete(hook);
  };
}

function isUnauthorized(failure: unknown): boolean {
  return (failure as { status?: unknown } | null)?.status === 401;
}

/**
 * 만료가 가까우면(session.ts의 tokenNeedsRenewal) 같은 모드의 새 토큰을 받는다. 'none'은 연장할 필요가 없거나
 * 네트워크 오류 등으로 이번엔 못 한 경우(지금 토큰을 계속 쓴다), 'unauthorized'는 서버가 401로 거절한 경우(로그아웃).
 */
async function renewIfNeeded(token: string): Promise<AuthResponse | 'none' | 'unauthorized'> {
  if (!tokenNeedsRenewal(token)) return 'none';
  try {
    const renewed = await refreshToken(token);
    // 응답을 기다리는 사이 로그아웃·다른 계정 로그인이 있었다면 그 상태를 덮어쓰지 않는다.
    if (getStoredToken() !== token) return 'none';
    storeToken(renewed.token);
    return renewed;
  } catch (failure) {
    return isUnauthorized(failure) ? 'unauthorized' : 'none';
  }
}

async function resolveInitialAuthState(): Promise<AuthState> {
  const token = getStoredToken();
  if (!token) {
    setLocalProgressOwner(null);
    return { status: 'anonymous' };
  }
  try {
    const user = await fetchCurrentUser(token);
    const renewed = await renewIfNeeded(token);
    if (renewed === 'unauthorized') throw new Error('refresh rejected');
    const next = renewed === 'none' ? { token, user } : renewed;
    setLocalProgressOwner(next.user.id);
    return { status: 'authenticated', token: next.token, user: next.user };
  } catch {
    // 토큰이 만료/무효화된 경우 - 재로그인하도록 익명 상태로 되돌린다.
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
    const token = getStoredToken();
    if (token) {
      for (const hook of beforeLogoutHooks) {
        try {
          hook(token);
        } catch {
          // 정리 요청이 실패해도 로그아웃은 막지 않는다.
        }
      }
    }
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

  // 앱이 다시 앞으로 올 때(탭 전환·앱 복귀) 만료가 가까우면 연장하고, 이미 만료됐으면 로그아웃한다 - 시작 시점
  // 확인은 resolveInitialAuthState가 한다. 네이티브 앱은 WebView의 visibilitychange와 Capacitor가 document에
  // 보내는 resume 이벤트를 함께 듣는다(@capacitor/app 플러그인 없이).
  const currentToken = state.status === 'authenticated' ? state.token : null;
  const renewingRef = useRef(false);
  useEffect(() => {
    if (!currentToken || typeof document === 'undefined') return;
    const onForeground = () => {
      if (document.visibilityState === 'hidden' || renewingRef.current) return;
      if (tokenIsExpired(currentToken)) {
        logout();
        return;
      }
      renewingRef.current = true;
      void renewIfNeeded(currentToken)
        .then((renewed) => {
          if (renewed === 'unauthorized') {
            logout();
          } else if (renewed !== 'none') {
            setState((prev) =>
              prev.status === 'authenticated' && prev.token === currentToken
                ? { status: 'authenticated', token: renewed.token, user: renewed.user }
                : prev,
            );
          }
        })
        .finally(() => {
          renewingRef.current = false;
        });
    };
    document.addEventListener('visibilitychange', onForeground);
    document.addEventListener('resume', onForeground);
    return () => {
      document.removeEventListener('visibilitychange', onForeground);
      document.removeEventListener('resume', onForeground);
    };
  }, [currentToken, logout]);

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
