import type { Lesson } from '@/entities/lesson';

/** 진행 중인 수업이 있으면 그것, 없으면 지금 이후 가장 가까운 예정 수업. 둘 다 없으면 null. */
export function pickNextLesson(lessons: Lesson[], now: Date): Lesson | null {
  const inProgress = lessons.find((lesson) => lesson.status === 'IN_PROGRESS');
  if (inProgress) return inProgress;
  const upcoming = lessons
    .filter((lesson) => lesson.status === 'SCHEDULED' && lesson.scheduledAt !== null && new Date(lesson.scheduledAt) >= startOfDay(now))
    .sort((a, b) => (a.scheduledAt as string).localeCompare(b.scheduledAt as string));
  return upcoming[0] ?? null;
}

/** 오늘(로컬 날짜) 잡힌 수업 수 - 완료된 것도 센다. */
export function countToday(lessons: Lesson[], now: Date): number {
  const start = startOfDay(now).getTime();
  const end = start + 24 * 60 * 60 * 1000;
  return lessons.filter((lesson) => {
    if (!lesson.scheduledAt) return false;
    const t = new Date(lesson.scheduledAt).getTime();
    return t >= start && t < end;
  }).length;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

const TIME_FORMAT = new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit' });

export function formatLessonTime(date: Date) {
  return TIME_FORMAT.format(date);
}

const MONTH_DAY_FORMAT = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });

/** 다음 수업 시각 - "오늘 오후 3:00", "내일 오전 10:00", 그 뒤로는 "10월 28일 (화) 오후 3:00". */
export function lessonWhen(iso: string, now: Date = new Date()) {
  const date = new Date(iso);
  const days = Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / (24 * 60 * 60 * 1000));
  const day = days === 0 ? '오늘' : days === 1 ? '내일' : MONTH_DAY_FORMAT.format(date);
  return `${day} ${formatLessonTime(date)}`;
}

