const SESSION_STORAGE_KEY = 'qstory.auth.session.v1';

/** 남은 수명이 이보다 짧으면 앱 시작·복귀 때 POST /v1/auth/refresh로 연장한다. */
export const REMEMBER_ME_RENEW_WITHIN_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_RENEW_WITHIN_MS = 2 * 60 * 60 * 1000;

type TokenClaims = { exp?: unknown; rm?: unknown };

/** JWT payload를 서명 검증 없이 읽는다 - 저장 위치·연장 시점을 고르는 데만 쓰고, 신뢰 판단은 서버가 한다. */
function readClaims(token: string): TokenClaims | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = decodeURIComponent(
      Array.from(atob(padded), (char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''),
    );
    const claims: unknown = JSON.parse(json);
    return claims && typeof claims === 'object' ? (claims as TokenClaims) : null;
  } catch {
    return null;
  }
}

/** "로그인 유지"로 발급된 토큰인지 - rm claim이 없는 토큰(이 기능 이전 발급, 회원가입)은 유지로 본다. */
export function tokenRemembersLogin(token: string): boolean {
  return readClaims(token)?.rm !== false;
}

/** 만료 시각(ms). exp를 읽을 수 없으면 null. */
export function tokenExpiresAtMs(token: string): number | null {
  const exp = readClaims(token)?.exp;
  return typeof exp === 'number' && Number.isFinite(exp) ? exp * 1000 : null;
}

/**
 * 지금 연장해야 하는지 - 로그인 유지 토큰은 만료 7일 전부터, 유지 안 함 토큰은 2시간 전부터. 이미 만료됐거나
 * exp를 읽을 수 없으면 false(연장 요청은 401이 될 뿐이라 /v1/auth/me 확인에 맡긴다).
 */
export function tokenNeedsRenewal(token: string, nowMs: number = Date.now()): boolean {
  const expiresAt = tokenExpiresAtMs(token);
  if (expiresAt === null || expiresAt <= nowMs) return false;
  const window = tokenRemembersLogin(token) ? REMEMBER_ME_RENEW_WITHIN_MS : SESSION_RENEW_WITHIN_MS;
  return expiresAt - nowMs <= window;
}

/** exp가 이미 지났는지 - 앱으로 돌아왔을 때 만료된 토큰이면 로그아웃한다. exp를 읽을 수 없으면 false(서버 판단에 맡긴다). */
export function tokenIsExpired(token: string, nowMs: number = Date.now()): boolean {
  const expiresAt = tokenExpiresAtMs(token);
  return expiresAt !== null && expiresAt <= nowMs;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Storages = { local: () => StorageLike | undefined; session: () => StorageLike | undefined };

function safely<T>(run: () => T, fallback: T): T {
  try {
    return run();
  } catch {
    // 저장소가 없거나 막힌 환경(개인정보 보호 모드 등) - 로그인 자체는 막지 않는다.
    return fallback;
  }
}

/**
 * 쿠키가 아니라 웹 저장소에 담긴 bearer 토큰이다: 동일 출처(same-origin) Vercel/Docker 프록시
 * (api/_qstory-proxy-core.mjs)는 쿠키 전달(forwarding) 기능이 없는, 요청마다 상태를 갖지 않는
 * (stateless) 함수이므로, 명시적인 Authorization 헤더로 보내는 bearer 토큰이야말로 실제로
 * 이 hop을 무사히 통과하는 형태다 (auth plan 문서의 frontend 섹션 참고).
 *
 * "로그인 유지" 토큰은 localStorage(브라우저를 닫아도 남음), 아닌 토큰은 sessionStorage(탭을 닫으면 사라짐 -
 * 네이티브 앱은 앱 프로세스가 종료될 때까지 남는다)에 둔다. 어느 쪽인지는 토큰의 rm claim으로 정하므로 refresh나
 * 유치원 등록으로 받은 새 토큰도 같은 곳에 저장된다.
 */
export function createTokenStore(storages: Storages) {
  return {
    get(): string | null {
      return (
        safely(() => storages.session()?.getItem(SESSION_STORAGE_KEY) ?? null, null) ??
        safely(() => storages.local()?.getItem(SESSION_STORAGE_KEY) ?? null, null)
      );
    },
    store(token: string): void {
      const remember = tokenRemembersLogin(token);
      const [target, other] = remember ? [storages.local, storages.session] : [storages.session, storages.local];
      safely(() => other()?.removeItem(SESSION_STORAGE_KEY), undefined);
      safely(() => target()?.setItem(SESSION_STORAGE_KEY, token), undefined);
    },
    clear(): void {
      safely(() => storages.local()?.removeItem(SESSION_STORAGE_KEY), undefined);
      safely(() => storages.session()?.removeItem(SESSION_STORAGE_KEY), undefined);
    },
  };
}

const browserTokenStore = createTokenStore({
  local: () => globalThis.localStorage,
  session: () => globalThis.sessionStorage,
});

export function getStoredToken(): string | null {
  return browserTokenStore.get();
}

export function storeToken(token: string): void {
  browserTokenStore.store(token);
}

export function clearStoredToken(): void {
  browserTokenStore.clear();
}
