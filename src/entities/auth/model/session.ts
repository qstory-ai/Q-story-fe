const SESSION_STORAGE_KEY = 'qstory.auth.session.v1';

/**
 * 쿠키가 아니라 localStorage에 담긴 bearer 토큰이다: 동일 출처(same-origin) Vercel/Docker 프록시
 * (api/_qstory-proxy-core.mjs)는 쿠키 전달(forwarding) 기능이 없는, 요청마다 상태를 갖지 않는
 * (stateless) 함수이므로, 명시적인 Authorization 헤더로 보내는 bearer 토큰이야말로 실제로
 * 이 hop을 무사히 통과하는 형태다 (auth plan 문서의 frontend 섹션 참고).
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
