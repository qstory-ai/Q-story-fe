import type { Lesson } from '../api/lesson-api';

/**
 * 반 상세의 수업 목록 - 이 반 수업 중 아직 끝나지 않은 것(진행 중 먼저, 이어서 가까운 일정순, 일정 미정은 뒤)과
 * 최근에 끝난 것 몇 개. 최대 limit개.
 */
export function pickClassLessons(lessons: readonly Lesson[], classId: string, limit = 5, recentDone = 2): Lesson[] {
  const mine = lessons.filter((lesson) => lesson.classGroupId === classId);
  const open = mine
    .filter((lesson) => lesson.status !== 'COMPLETED')
    .sort((a, b) => {
      if ((a.status === 'IN_PROGRESS') !== (b.status === 'IN_PROGRESS')) return a.status === 'IN_PROGRESS' ? -1 : 1;
      const at = a.scheduledAt ? Date.parse(a.scheduledAt) : Number.POSITIVE_INFINITY;
      const bt = b.scheduledAt ? Date.parse(b.scheduledAt) : Number.POSITIVE_INFINITY;
      return at - bt;
    });
  const done = mine
    .filter((lesson) => lesson.status === 'COMPLETED')
    .sort((a, b) => Date.parse(b.completedAt ?? b.scheduledAt ?? b.createdAt) - Date.parse(a.completedAt ?? a.scheduledAt ?? a.createdAt))
    .slice(0, recentDone);
  const openLimit = Math.max(limit - done.length, 0);
  return [...open.slice(0, openLimit), ...done].slice(0, limit);
}
