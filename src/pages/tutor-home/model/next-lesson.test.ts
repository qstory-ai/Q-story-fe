/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Lesson } from '@/entities/lesson';

import { countToday, lessonWhen, pickNextLesson } from './next-lesson';

function lesson(id: string, status: Lesson['status'], scheduledAt: string | null): Lesson {
  return {
    id,
    name: id,
    goal: null,
    scheduledAt,
    status,
    startedAt: null,
    completedAt: null,
    students: [],
    storyIds: [],
    createdAt: '2026-10-01T00:00:00',
    updatedAt: '2026-10-01T00:00:00',
    seriesId: null,
    classGroupId: null,
    classGroupName: null,
  };
}

const NOW = new Date(2026, 9, 24, 13, 0);

test('진행 중인 수업이 있으면 그것을 다음 수업으로 고른다', () => {
  const lessons = [lesson('a', 'SCHEDULED', '2026-10-24T15:00:00'), lesson('b', 'IN_PROGRESS', '2026-10-20T10:00:00')];
  assert.equal(pickNextLesson(lessons, NOW)?.id, 'b');
});

test('없으면 오늘 이후 가장 가까운 예정 수업 - 지난 날·완료·시각 없는 수업은 뺀다', () => {
  const lessons = [
    lesson('past', 'SCHEDULED', '2026-10-23T09:00:00'),
    lesson('done', 'COMPLETED', '2026-10-24T09:00:00'),
    lesson('later', 'SCHEDULED', '2026-10-27T09:00:00'),
    lesson('soon', 'SCHEDULED', '2026-10-25T09:00:00'),
    lesson('noTime', 'SCHEDULED', null),
  ];
  assert.equal(pickNextLesson(lessons, NOW)?.id, 'soon');
  assert.equal(pickNextLesson([lesson('past', 'SCHEDULED', '2026-10-23T09:00:00')], NOW), null);
});

test('오늘 수업 수는 완료된 것까지 오늘 날짜만 센다', () => {
  const lessons = [
    lesson('a', 'COMPLETED', '2026-10-24T09:00:00'),
    lesson('b', 'SCHEDULED', '2026-10-24T18:00:00'),
    lesson('c', 'SCHEDULED', '2026-10-25T00:00:00'),
  ];
  assert.equal(countToday(lessons, NOW), 2);
});

test('다음 수업 시각은 오늘·내일, 그 뒤로는 날짜로', () => {
  assert.match(lessonWhen('2026-10-24T15:00:00', NOW), /^오늘 /);
  assert.match(lessonWhen('2026-10-25T10:00:00', NOW), /^내일 /);
  assert.match(lessonWhen('2026-10-28T10:00:00', NOW), /^10월 28일/);
});
