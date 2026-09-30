import { useEffect, useMemo } from 'react';

import type { UserSummary } from '../api/auth-api';
import { useAuth } from './current-user';

export type DirectorSession = { token: string; user: UserSummary; organizationId: string };

/**
 * 기관 관리자 화면 공통 가드 - 기관이 있는 DIRECTOR 세션만 돌려주고, 인증 확인이 끝났는데 조건이
 * 맞지 않으면 '/'로 보낸다. entities 레이어가 라우터에 의존하지 않도록 navigate는 호출부가 넘긴다.
 */
export function useDirectorSession(
  navigate: (path: string, options: { replace: boolean }) => void,
): DirectorSession | null {
  const { state } = useAuth();
  const user = state.status === 'authenticated' && state.user.role === 'DIRECTOR' ? state.user : null;
  const token = user && state.status === 'authenticated' ? state.token : null;
  const organizationId = user?.organizationId ?? null;

  const session = useMemo<DirectorSession | null>(
    () => (user && token && organizationId ? { token, user, organizationId } : null),
    [user, token, organizationId],
  );

  const allowed = session !== null;
  useEffect(() => {
    if (state.status !== 'loading' && !allowed) navigate('/', { replace: true });
  }, [state.status, allowed, navigate]);

  return session;
}
