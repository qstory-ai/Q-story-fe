import { useEffect } from 'react';

import type { Role } from '../api/auth-api';
import { useAuth } from './current-user';

/**
 * 역할이 맞는 로그인 세션만 머물게 하는 화면 가드 - 인증 확인이 끝났는데 로그인하지 않았거나 역할이 다르면 fallbackPath로
 * 보낸다(replace라 뒤로가기에 남지 않는다). 선생님·보호자·스태프 화면 16곳이 같은 effect를 각자 적던 것을 모았다.
 * entities 레이어가 라우터에 의존하지 않도록 navigate는 호출부가 넘긴다. 돌려주는 값은 지금 역할이 맞는지.
 */
export function useRoleGuard(
  navigate: (path: string, options: { replace: boolean }) => void,
  roles: readonly Role[],
  fallbackPath = '/',
): boolean {
  const { state } = useAuth();
  const allowed = state.status === 'authenticated' && roles.includes(state.user.role);
  useEffect(() => {
    if (state.status !== 'loading' && !allowed) navigate(fallbackPath, { replace: true });
  }, [state.status, allowed, navigate, fallbackPath]);
  return allowed;
}
