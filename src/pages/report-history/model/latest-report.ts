/**
 * 리포트 탭의 기본 보기는 "가장 최근 개별 리포트" - 목록 순서(서버 정렬)에 기대지 않고 마친 시각으로
 * 최신 한 건을 꺼내고, 나머지는 최신순으로 "지난 리포트"에 둔다.
 */
export function splitLatestReport<T extends { completedAt: string }>(reports: readonly T[]): { latest: T | null; rest: T[] } {
  const sorted = [...reports].sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
  return { latest: sorted[0] ?? null, rest: sorted.slice(1) };
}
