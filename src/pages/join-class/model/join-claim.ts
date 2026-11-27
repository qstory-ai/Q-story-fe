/**
 * 체험 모드 QR(`/join?code=반코드&claim=연결코드`)의 연결 코드를 가입·로그인을 거치는 동안 잃지 않게 이 탭에 잠깐 둔다.
 * 가입하면 아이 등록을 거쳐 `/join?code=반코드`로 돌아오는데, 그때는 주소에 claim이 없다.
 */
const KEY = 'qstory.joinClaim';

type Stored = { code: string; claim: string };

export function normalizeClaim(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim().toUpperCase();
  return /^[A-Z0-9]{4,16}$/.test(value) ? value : null;
}

/** 주소의 claim을 우선하고(그때 저장), 없으면 같은 반 코드로 저장해 둔 claim을 쓴다. */
export function resolveJoinClaim(code: string, fromUrl: string | null, storage: Pick<Storage, 'getItem' | 'setItem'> | null): string | null {
  const claim = normalizeClaim(fromUrl);
  if (claim) {
    try {
      storage?.setItem(KEY, JSON.stringify({ code, claim } satisfies Stored));
    } catch {
      // 저장이 막혀도 이번 화면에서는 주소의 값으로 진행한다.
    }
    return claim;
  }
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Partial<Stored>;
    return stored.code === code ? normalizeClaim(stored.claim) : null;
  } catch {
    return null;
  }
}

export function clearJoinClaim(storage: Pick<Storage, 'removeItem'> | null) {
  try {
    storage?.removeItem(KEY);
  } catch {
    // 무시
  }
}

export function sessionStore(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}
