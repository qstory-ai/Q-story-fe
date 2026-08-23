const SESSION_STORAGE_KEY = 'qstory.auth.session.v1';

/**
 * A bearer token in localStorage, not a cookie: the same-origin Vercel/Docker proxy
 * (api/_qstory-proxy-core.mjs) is a stateless per-request function with no cookie
 * forwarding, so a bearer token sent as an explicit Authorization header is the shape that
 * actually survives that hop (see the auth plan doc's frontend section).
 */
export function getStoredToken(): string | null {
  try {
    return globalThis.localStorage?.getItem(SESSION_STORAGE_KEY) ?? null;
  } catch {
    // 저장소가 없는 환경(개인정보 보호 모드 등)에서는 로그인 상태를 유지하지 않는다.
    return null;
  }
}

export function storeToken(token: string): void {
  try {
    globalThis.localStorage?.setItem(SESSION_STORAGE_KEY, token);
  } catch {
    // 저장 실패는 로그인 자체를 막지 않는다 - 이 요청·세션 동안은 메모리 상태로 계속 동작한다.
  }
}

export function clearStoredToken(): void {
  try {
    globalThis.localStorage?.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // 비차단 조건이다.
  }
}
