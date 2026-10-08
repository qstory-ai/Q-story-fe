/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { completedOnly, isExitedSession } from './end-status';

test('EXITED만 멈춤, 값이 없으면 완주로 본다', () => {
  assert.equal(isExitedSession({ endStatus: 'EXITED' }), true);
  assert.equal(isExitedSession({ endStatus: 'COMPLETED' }), false);
  assert.equal(isExitedSession({ endStatus: null }), false);
  assert.equal(isExitedSession({}), false);
});

test('completedOnly는 멈춘 회차를 빼고 순서를 유지한다', () => {
  const items = [
    { id: 'a', endStatus: 'COMPLETED' as const },
    { id: 'b', endStatus: 'EXITED' as const },
    { id: 'c' },
  ];
  assert.deepEqual(completedOnly(items).map((i) => i.id), ['a', 'c']);
  assert.deepEqual(completedOnly([]), []);
});
