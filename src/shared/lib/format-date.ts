/** 화면 곳곳에서 쓰는 한국어 날짜 표기. 같은 모양을 페이지마다 Intl.DateTimeFormat으로 다시 만들지 않게 한 곳에 둔다. */
const LONG_DATE = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
const NUMERIC_DATE = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric' });
const MONTH_DAY = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' });
const MONTH_DAY_TIME = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const LONG_DATE_TIME = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
});

/** "2026년 3월 12일" */
export function formatLongDate(iso: string | Date): string {
  return LONG_DATE.format(new Date(iso));
}

/** "2026. 3. 12." */
export function formatNumericDate(iso: string | Date): string {
  return NUMERIC_DATE.format(new Date(iso));
}

/** "3월 12일" */
export function formatMonthDay(iso: string | Date): string {
  return MONTH_DAY.format(new Date(iso));
}

/** "3월 12일 오후 3:05" */
export function formatMonthDayTime(iso: string | Date): string {
  return MONTH_DAY_TIME.format(new Date(iso));
}

/** "2026년 3월 12일 오후 3:05" */
export function formatLongDateTime(iso: string | Date): string {
  return LONG_DATE_TIME.format(new Date(iso));
}
