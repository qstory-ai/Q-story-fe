const TUTORIAL_SEEN_KEY = 'qstory.tutorial.seen.v1';

/** 소개(튜토리얼) 화면을 떠날 때 남기는 마크 - 이후 재진입에는 소개를 건너뛴다(HomePage). */
export function markTutorialSeen(): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(TUTORIAL_SEEN_KEY, '1');
  } catch {
    // 프라이빗 모드 등에서 실패해도 튜토리얼은 이미 본 상태로 앱을 계속 쓸 수 있어야 한다.
  }
}

/** 튜토리얼을 이미 봤는지(재진입 시 자동 스킵할지) 판단. 서버 저장 없이 브라우저 로컬 마크만. */
export function hasSeenTutorial(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(TUTORIAL_SEEN_KEY) === '1';
  } catch {
    return true;
  }
}
