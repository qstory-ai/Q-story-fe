import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { clearLocalStoryProgress, setBetaEventAuthToken, setLocalProgressOwner } from '@/entities/analytics';
import { setRequestAuthToken } from '@/shared/api';

import { fetchCurrentUser, refreshToken, type UserSummary } from '../api/auth-api';
import { clearCachedUser, readCachedUser, storeCachedUser } from './cached-user';
import { clearStoredToken, getStoredToken, storeToken, tokenIsExpired } from './session';
import { renewIfNeeded, verifySession, type SessionDeps } from './verify-session';

export type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; token: string; user: UserSummary };

type AuthContextValue = {
  state: AuthState;
  /**
   * 지금 로그인 상태가 서버에서 확인된 것인지. false면 저장해 둔 사용자 요약(cached-user.ts)으로 먼저 그린 상태라
   * 이름·역할 같은 화면 분기 값만 있고 email·loginId·childName 등은 아직 비어 있다. 확인이 끝나면 true.
   */
  verified: boolean;
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

const sessionDeps: SessionDeps = { fetchCurrentUser, refreshToken, getStoredToken, storeToken };

function forgetSession() {
  clearStoredToken();
  clearCachedUser();
  setLocalProgressOwner(null);
}

/**
 * 첫 화면 상태. 토큰과 그 토큰 주인의 사용자 요약(cached-user.ts)이 저장돼 있으면 서버 확인을 기다리지 않고 바로
 * 로그인 상태로 그린다 - 아이 목록·저장한 작품·페이지 요청이 `/v1/auth/me`와 동시에 나간다. 확인은 뒤에서 하고,
 * 거절되면 로그아웃 처리한다. 저장된 요약이 없으면(첫 실행·예전 버전에서 올라온 경우) 예전처럼 확인을 기다린다.
 */
function initialAuthState(): AuthState {
  const token = getStoredToken();
  if (!token) return { status: 'loading' };
  if (tokenIsExpired(token)) return { status: 'loading' };
  const user = readCachedUser(token);
  if (!user) return { status: 'loading' };
  setLocalProgressOwner(user.id);
  return { status: 'authenticated', token, user };
}

/** 저장된 토큰을 확인해 다음 상태를 정한다. null - 기다리는 사이 로그아웃·다른 계정 로그인이 있어 덮어쓰지 않는다. */
async function resolveAuthState(): Promise<AuthState | null> {
  const token = getStoredToken();
  if (!token) {
    setLocalProgressOwner(null);
    return { status: 'anonymous' };
  }
  const check = await verifySession(token, sessionDeps);
  if (check.status === 'stale') return null;
  if (check.status === 'invalid') {
    // 토큰이 만료/무효화된 경우 - 재로그인하도록 익명 상태로 되돌린다.
    forgetSession();
    return { status: 'anonymous' };
  }
  storeCachedUser(check.token, check.user);
  setLocalProgressOwner(check.user.id);
  return { status: 'authenticated', token: check.token, user: check.user };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(initialAuthState);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void resolveAuthState().then((next) => {
      if (cancelled || !next) return;
      setState(next);
      setVerified(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setSession = useCallback((token: string, user: UserSummary) => {
    storeToken(token);
    storeCachedUser(token, user);
    setLocalProgressOwner(user.id);
    setState({ status: 'authenticated', token, user });
    setVerified(true);
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
    forgetSession();
    setState({ status: 'anonymous' });
  }, []);

  const refresh = useCallback(async () => {
    const next = await resolveAuthState();
    if (!next) return;
    setState(next);
    setVerified(true);
  }, []);

  const updateUser = useCallback((user: UserSummary) => {
    const token = getStoredToken();
    if (token) storeCachedUser(token, user);
    setState((prev) => (prev.status === 'authenticated' ? { ...prev, user } : prev));
  }, []);

  // 앱이 다시 앞으로 올 때(탭 전환·앱 복귀) 만료가 가까우면 연장하고, 이미 만료됐으면 로그아웃한다 - 시작 시점
  // 확인은 resolveAuthState가 한다. 네이티브 앱은 WebView의 visibilitychange와 Capacitor가 document에
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
      void renewIfNeeded(currentToken, sessionDeps)
        .then((renewed) => {
          if (renewed === 'unauthorized') {
            logout();
          } else if (renewed !== 'none') {
            storeCachedUser(renewed.token, renewed.user);
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
    () => ({ state, verified, setSession, logout, refresh, updateUser }),
    [state, verified, setSession, logout, refresh, updateUser],
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
