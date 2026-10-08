// @ts-nocheck -- Node 테스트 러너 타입은 Expo 번들에서 의도적으로 제외한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { splitReplaySegments } from './replay-segments';

const visit = (start) => [
  { type: 4, timestamp: start },
  { type: 2, timestamp: start + 1 },
  { type: 3, timestamp: start + 1_000 },
];

test('events are sorted and split into visits at gaps over 5 minutes', () => {
  const later = 1_000_000;
  const segments = splitReplaySegments([...visit(later), ...visit(0)]);
  assert.equal(segments.length, 2);
  assert.equal(segments[0].startedAt, 0);
  assert.equal(segments[1].startedAt, later);
  assert.equal(segments[1].events.length, 3);
});

test('a visit without a full snapshot is left out, and events before the first meta are trimmed', () => {
  const segments = splitReplaySegments([
    { type: 3, timestamp: 0 },
    { type: 3, timestamp: 1 },
    { type: 4, timestamp: 3 },
    { type: 2, timestamp: 4 },
    'not an event',
    { type: 3, timestamp: 10_000_000 },
    { type: 3, timestamp: 10_000_001 },
  ]);
  assert.equal(segments.length, 1);
  assert.equal(segments[0].startedAt, 3);
  assert.equal(segments[0].events.length, 2);
});
