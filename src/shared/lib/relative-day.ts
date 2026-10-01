const DAY_MS = 24 * 60 * 60 * 1000;

/** "오늘/어제/N일 전에" - 달력 날짜(로컬) 기준. "이어서 읽기"처럼 문장 가운데에 넣는다. */
export function relativeDayLabel(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '오늘';
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(then)) / DAY_MS);
  if (days <= 0) return '오늘';
  if (days === 1) return '어제';
  return `${days}일 전에`;
}
