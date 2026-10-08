/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ClassReportItem } from '../api/story-completion-api';
import { latestClassReports, summarizeStudentNames } from './class-reports';

function item(id: string, completedAt: string): ClassReportItem {
  return {
    id,
    storyId: 's',
    completedAt,
    durationSeconds: null,
    childId: null,
    companionChatSummary: null,
    tutorStudentId: null,
    lessonId: null,
    sessionKind: 'CLASS',
    participantCount: 3,
    tutorName: '선생님',
    studentNames: [],
  };
}

test('latestClassReports는 최신순으로 limit개만 남긴다', () => {
  const result = latestClassReports(
    [item('a', '2026-10-01T00:00:00Z'), item('c', '2026-10-03T00:00:00Z'), item('b', '2026-10-02T00:00:00Z')],
    2,
  );
  assert.deepEqual(result.map((r) => r.id), ['c', 'b']);
});

test('summarizeStudentNames는 많으면 외 N명으로 줄인다', () => {
  assert.equal(summarizeStudentNames([]), null);
  assert.equal(summarizeStudentNames(undefined), null);
  assert.equal(summarizeStudentNames(['지민']), '지민');
  assert.equal(summarizeStudentNames(['지민', '서준']), '지민, 서준');
  assert.equal(summarizeStudentNames(['지민', '서준', '하윤', '도윤']), '지민, 서준 외 2명');
});
