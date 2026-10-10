/**
 * 리포트 탭의 기본 보기는 "지난 리포트 목록 + 달력" - 목록 순서(서버 정렬)에 기대지 않고 마친 시각으로
 * 최신순으로 늘어놓는다. 달력은 가장 최근 기록 날에서 연다.
 */
export function newestFirst<T extends { completedAt: string }>(reports: readonly T[]): T[] {
  return [...reports].sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
}

/** 종합 리포트는 두 편 이상 모였을 때만 따로 보여 준다 - 한 편뿐이면 그 리포트와 같은 이야기라서. */
export const COMPREHENSIVE_MIN_SESSIONS = 2;

export function showComprehensiveTab(sessionCount: number): boolean {
  return sessionCount >= COMPREHENSIVE_MIN_SESSIONS;
}
