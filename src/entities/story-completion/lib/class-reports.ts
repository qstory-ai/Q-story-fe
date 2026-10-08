import type { ClassReportItem } from '../api/story-completion-api';

/** 최신순으로 정렬해 앞에서 limit개만 - 서버 순서를 믿지 않고 한 번 더 정리한다. */
export function latestClassReports(items: readonly ClassReportItem[], limit = 10): ClassReportItem[] {
  return [...items]
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))
    .slice(0, limit);
}

/** "지민, 서준 외 2명" - 이름이 없으면 null(호출부가 줄을 생략). */
export function summarizeStudentNames(names: readonly string[] | null | undefined, max = 2): string | null {
  const list = (names ?? []).filter((name) => name.trim().length > 0);
  if (list.length === 0) return null;
  if (list.length <= max) return list.join(', ');
  return `${list.slice(0, max).join(', ')} 외 ${list.length - max}명`;
}
