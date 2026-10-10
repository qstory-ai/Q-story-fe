/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { newestFirst, showComprehensiveTab } from './report-order';

const r = (id: string, completedAt: string) => ({ id, completedAt });

test('지난 리포트는 마친 시각 기준 최신순', () => {
  const sorted = newestFirst([
    r('old', '2026-09-01T00:00:00Z'),
    r('new', '2026-10-02T00:00:00Z'),
    r('mid', '2026-09-20T00:00:00Z'),
  ]);
  assert.deepEqual(sorted.map((x) => x.id), ['new', 'mid', 'old']);
});

test('리포트가 없으면 빈 목록', () => {
  assert.deepEqual(newestFirst([]), []);
});

test('종합 리포트는 두 편 이상일 때만', () => {
  assert.equal(showComprehensiveTab(0), false);
  assert.equal(showComprehensiveTab(1), false);
  assert.equal(showComprehensiveTab(2), true);
});
