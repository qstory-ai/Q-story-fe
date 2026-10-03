/**
 * 수업 만들기 모달의 날짜 계산(Q-35에서 모달에서 분리). 날짜는 모두 텍스트로 받는다 - "YYYY-MM-DD HH:MM".
 */

export const DEFAULT_RECURRING_COUNT = 12; // 학기 3개월 기준 근사치
export const MAX_RECURRING_COUNT = 60;
export const DEFAULT_LESSON_TIME = '15:00';

export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

const pad2 = (n: number) => String(n).padStart(2, '0');

export function formatDateOnly(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function parseDateOnly(raw: string): Date | null {
  const match = raw.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;
  const [, y, mo, d] = match;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  // 2026-02-31 같은 값은 Date가 다음 달로 넘겨 버린다 - 그대로 받지 않는다.
  if (Number.isNaN(date.getTime()) || date.getMonth() !== Number(mo) - 1 || date.getDate() !== Number(d)) return null;
  return date;
}

export function parseHourMinute(raw: string): [number, number] | [null, null] {
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return [null, null];
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return [null, null];
  return [hh, mm];
}

/** "YYYY-MM-DD HH:MM" → 로컬 Date. 시각을 빼면 기본 시각(15:00). 틀린 형식은 null. */
export function parseLessonDateTime(raw: string): Date | null {
  const [datePart, timePart = DEFAULT_LESSON_TIME, ...rest] = raw.trim().split(/\s+/);
  if (!datePart || rest.length > 0) return null;
  const date = parseDateOnly(datePart);
  const [hh, mm] = parseHourMinute(timePart);
  if (!date || hh == null || mm == null) return null;
  date.setHours(hh, mm, 0, 0);
  return date;
}

/** 단발 수업·편집용 - 비어 있으면 null("일정 미정"), 틀린 형식도 null. */
export function parseDateTime(raw: string): string | null {
  if (!raw.trim()) return null;
  return parseLessonDateTime(raw)?.toISOString() ?? null;
}

/** ISO 문자열을 로컬 시각 기준 "YYYY-MM-DD HH:MM" 입력 형식으로 되돌린다 - parseDateTime의 역함수. */
export function formatDateTimeForInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${formatDateOnly(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** 새 수업의 첫 수업 기본값 - 오늘 15:00. */
export function defaultFirstLessonInput(now: Date): string {
  return `${formatDateOnly(now)} ${DEFAULT_LESSON_TIME}`;
}

/**
 * 정기 수업의 실제 회차(ISO 목록). 첫 수업 일시부터 하루씩 넘기며 weekdays에 든 요일이면 그 시각으로 넣는다.
 * weekdays가 비어 있으면 첫 수업의 요일 하나("매주 같은 요일")로 본다.
 *  - endDate가 없으면 count회(최대 60회 - 실수로 몇백 개를 만들지 못하게).
 *  - endDate가 있으면 그날까지(포함), 그래도 최대 60회.
 * 입력이 이상하면 빈 배열 - 화면이 "만들 수 있는 수업이 없어요"로 안내한다.
 */
export function computeRecurringDates(input: {
  firstLesson: string;
  count: number;
  weekdays?: ReadonlySet<number>;
  endDate?: string;
}): string[] {
  const start = parseLessonDateTime(input.firstLesson);
  if (!start) return [];
  const weekdays = input.weekdays && input.weekdays.size > 0 ? input.weekdays : new Set([start.getDay()]);
  const end = input.endDate ? parseDateOnly(input.endDate) : null;
  if (input.endDate && !end) return [];
  const limit = end ? MAX_RECURRING_COUNT : Math.min(Math.max(Math.floor(input.count), 0), MAX_RECURRING_COUNT);
  if (limit === 0) return [];

  const dates: string[] = [];
  const HARD_DAY_LIMIT = 366 * 2; // startDate와 end가 아주 멀어도 무한 루프 방지.
  const cursor = new Date(start);
  for (let i = 0; i < HARD_DAY_LIMIT && dates.length < limit; i += 1) {
    if (end && cursor > endOfDay(end)) break;
    if (weekdays.has(cursor.getDay())) dates.push(cursor.toISOString());
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

/** "매주 목요일 15:00 · 12회 (10월 8일 ~ 12월 24일)" 같은 요약. 만들 회차가 없으면 null. */
export function describeRecurrence(dates: string[], weekdays: ReadonlySet<number> | null): string | null {
  if (dates.length === 0) return null;
  const first = new Date(dates[0]);
  const last = new Date(dates[dates.length - 1]);
  const days = weekdays && weekdays.size > 0 ? [...weekdays].sort((a, b) => a - b) : [first.getDay()];
  const dayLabel = days.map((day) => WEEKDAY_LABELS[day]).join('·');
  const time = `${pad2(first.getHours())}:${pad2(first.getMinutes())}`;
  const md = (date: Date) => `${date.getMonth() + 1}월 ${date.getDate()}일`;
  return `매주 ${dayLabel}요일 ${time} · ${dates.length}회 (${md(first)} ~ ${md(last)})`;
}
