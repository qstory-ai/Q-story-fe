/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Lesson } from '../api/lesson-api';
import { pickClassLessons } from './class-lessons';

function lesson(id: string, over: Partial<Lesson>): Lesson {
  return {
    id, name: id, goal: null, scheduledAt: null, status: 'SCHEDULED', startedAt: null, completedAt: null,
    students: [], storyIds: [], createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
    seriesId: null, classGroupId: 'c1', classGroupName: '해님반', ...over,
  };
}

test('이 반 수업만, 진행 중 → 가까운 일정 → 미정 순, 끝난 수업은 최근 것 뒤에', () => {
  const result = pickClassLessons(
    [
      lesson('later', { scheduledAt: '2026-11-02T00:00:00Z' }),
      lesson('none', {}),
      lesson('soon', { scheduledAt: '2026-10-20T00:00:00Z' }),
      lesson('going', { status: 'IN_PROGRESS', scheduledAt: '2026-12-01T00:00:00Z' }),
      lesson('other', { classGroupId: 'c2' }),
      lesson('old', { status: 'COMPLETED', completedAt: '2026-09-01T00:00:00Z' }),
      lesson('recent', { status: 'COMPLETED', completedAt: '2026-10-05T00:00:00Z' }),
    ],
    'c1',
    5,
    2,
  );
  assert.deepEqual(result.map((l) => l.id), ['going', 'soon', 'later', 'recent', 'old'].slice(0, 5));
});

test('limit를 넘지 않는다', () => {
  const many = Array.from({ length: 8 }, (_, i) => lesson(`l${i}`, { scheduledAt: `2026-10-${10 + i}T00:00:00Z` }));
  assert.equal(pickClassLessons(many, 'c1', 5).length, 5);
});
