const UT_STORAGE_KEY = 'qstory.ut-mode.v1';

/**
 * UT(사용자 테스트) 모드 판정 - 순수 함수. 주소에 ut=1 이거나 traffic_type=ut 이면 켜지고,
 * 한 번 켜진 값(stored)은 같은 브라우저 세션 동안 유지된다.
 */
export function utModeForUrl(href: string | null | undefined, stored: boolean): boolean {
  if (stored) return true;
  if (!href) return false;
  try {
    const params = new URL(href).searchParams;
    return params.get('ut') === '1' || params.get('traffic_type') === 'ut';
  } catch {
    return false;
  }
}

/** 현재 화면이 UT 모드인지 - 켜졌다면 sessionStorage에 남겨 화면 이동 후에도 유지한다. */
export function isUtMode(): boolean {
  if (typeof window === 'undefined') return false;
  let stored = false;
  try {
    stored = window.sessionStorage?.getItem(UT_STORAGE_KEY) === '1';
  } catch {
    // 저장소를 못 읽어도 주소만으로 판단한다.
  }
  const on = utModeForUrl(window.location.href, stored);
  if (on && !stored) {
    try {
      window.sessionStorage?.setItem(UT_STORAGE_KEY, '1');
    } catch {
      // 저장 실패는 무시 - 다음 화면에서 주소에 플래그가 없으면 꺼진다.
    }
  }
  return on;
}
