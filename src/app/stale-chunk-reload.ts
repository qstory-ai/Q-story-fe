/**
 * 배포 뒤 오래 열어 둔 탭 - 예전 화면 조각(index-XXXX.js)이 서버에서 사라져 "Failed to fetch dynamically imported module"로
 * 화면이 비었다(10/24, 하루 배포가 많던 날 /parent·/tutor·/에서). 이 오류면 한 번만 새로 고쳐 새 화면 조각을 받는다.
 * 새로 고친 뒤에도 바로 또 나면(진짜 네트워크 문제) 30초 안에는 다시 새로 고치지 않아 무한 새로 고침을 막는다.
 */
const STALE_CHUNK_PATTERN =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i;

export const STALE_RELOAD_KEY = 'qstory.staleChunkReloadAt';
export const STALE_RELOAD_COOLDOWN_MS = 30_000;

export function isStaleChunkError(message: string): boolean {
  return STALE_CHUNK_PATTERN.test(message);
}

type ReloadDeps = {
  now: () => number;
  storage: Pick<Storage, 'getItem' | 'setItem'> | null;
  reload: () => void;
};

/** 새로 고쳤으면 true. 쿨다운 안이면 false(오류 화면을 그대로 둔다). */
export function reloadForStaleChunk(deps: ReloadDeps): boolean {
  const now = deps.now();
  try {
    const last = Number(deps.storage?.getItem(STALE_RELOAD_KEY) ?? 0);
    if (now - last < STALE_RELOAD_COOLDOWN_MS) return false;
    deps.storage?.setItem(STALE_RELOAD_KEY, String(now));
  } catch {
    // 저장소를 못 쓰는 환경(사생활 보호 모드 등)이어도 한 번은 새로 고친다.
  }
  deps.reload();
  return true;
}

const browserDeps = (): ReloadDeps => ({
  now: () => Date.now(),
  storage: (() => {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  })(),
  reload: () => window.location.reload(),
});

/** 브라우저에서 화면 조각을 못 불러오면 한 번 새로 고친다. 새로 고쳤으면 true. */
export function reloadIfStaleChunk(message: string): boolean {
  return isStaleChunkError(message) && reloadForStaleChunk(browserDeps());
}

/** Vite가 화면 조각 미리 받기에 실패하면 내는 이벤트 - 렌더 오류가 나기 전에 먼저 새로 고친다. */
export function installStaleChunkReload(): void {
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadForStaleChunk(browserDeps())) event.preventDefault();
  });
}
