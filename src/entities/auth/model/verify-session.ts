import type { AuthResponse, UserSummary } from '../api/auth-api';
import { tokenIsExpired, tokenNeedsRenewal } from './session';

export type SessionDeps = {
  fetchCurrentUser: (token: string) => Promise<UserSummary>;
  refreshToken: (token: string) => Promise<AuthResponse>;
  getStoredToken: () => string | null;
  storeToken: (token: string) => void;
  now?: () => number;
};

/** 'stale' - 기다리는 사이 로그아웃·다른 계정 로그인이 있었다. 그 상태를 덮어쓰지 않는다. */
export type SessionCheck = { status: 'valid'; token: string; user: UserSummary } | { status: 'invalid' } | { status: 'stale' };

function isUnauthorized(failure: unknown): boolean {
  return (failure as { status?: unknown } | null)?.status === 401;
}

/**
 * 만료가 가까우면(session.ts의 tokenNeedsRenewal) 같은 모드의 새 토큰을 받는다. 'none'은 연장할 필요가 없거나
 * 네트워크 오류 등으로 이번엔 못 한 경우(지금 토큰을 계속 쓴다), 'unauthorized'는 서버가 401로 거절한 경우(로그아웃).
 */
export async function renewIfNeeded(
  token: string,
  deps: SessionDeps,
): Promise<AuthResponse | 'none' | 'unauthorized'> {
  if (!tokenNeedsRenewal(token, deps.now?.())) return 'none';
  try {
    const renewed = await deps.refreshToken(token);
    // 응답을 기다리는 사이 로그아웃·다른 계정 로그인이 있었다면 그 상태를 덮어쓰지 않는다.
    if (deps.getStoredToken() !== token) return 'none';
    deps.storeToken(renewed.token);
    return renewed;
  } catch (failure) {
    return isUnauthorized(failure) ? 'unauthorized' : 'none';
  }
}

/**
 * 저장된 토큰을 서버에 확인한다 - 내 정보 조회와 (필요하면) 토큰 연장을 한꺼번에 보내 한 번의 왕복으로
 * 끝낸다. 연장에 성공하면 그 응답의 사용자를 쓰고, 아니면 `/me` 응답을 쓴다. 둘 다 없거나 연장이 401이면 'invalid'.
 */
export async function verifySession(token: string, deps: SessionDeps): Promise<SessionCheck> {
  if (tokenIsExpired(token, deps.now?.())) return { status: 'invalid' };
  const [me, renewed] = await Promise.all([
    deps.fetchCurrentUser(token).then(
      (user) => ({ ok: true as const, user }),
      () => ({ ok: false as const }),
    ),
    renewIfNeeded(token, deps),
  ]);
  const currentToken = renewed !== 'none' && renewed !== 'unauthorized' ? renewed.token : token;
  if (deps.getStoredToken() !== currentToken) return { status: 'stale' };
  if (renewed === 'unauthorized') return { status: 'invalid' };
  if (renewed !== 'none') return { status: 'valid', token: renewed.token, user: renewed.user };
  if (me.ok) return { status: 'valid', token, user: me.user };
  return { status: 'invalid' };
}
