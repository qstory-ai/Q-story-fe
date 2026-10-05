/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { splitLatestReport } from './latest-report';

const r = (id: string, completedAt: string) => ({ id, completedAt });

test('가장 최근에 마친 리포트를 앞에 꺼내고 나머지는 최신순', () => {
  const { latest, rest } = splitLatestReport([
    r('old', '2026-09-01T00:00:00Z'),
    r('new', '2026-10-02T00:00:00Z'),
    r('mid', '2026-09-20T00:00:00Z'),
  ]);
  assert.equal(latest?.id, 'new');
  assert.deepEqual(rest.map((x) => x.id), ['mid', 'old']);
});

test('리포트가 없으면 최신도 없다', () => {
  assert.deepEqual(splitLatestReport([]), { latest: null, rest: [] });
});
