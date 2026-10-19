import assert from 'node:assert/strict';
import test from 'node:test';

import { saveWithRetry } from './completion-save';

const noWait = async () => {};

test('잠깐 실패해도 다시 보내 저장한다', async () => {
  let calls = 0;
  const saved = await saveWithRetry(
    async () => {
      calls += 1;
      if (calls < 3) throw new Error('network');
      return 'record-1';
    },
    [1, 1],
    noWait,
  );
  assert.equal(saved, 'record-1');
  assert.equal(calls, 3);
});

test('마지막 시도까지 실패하면 실패를 알린다', async () => {
  let calls = 0;
  await assert.rejects(
    saveWithRetry(
      async () => {
        calls += 1;
        throw new Error('offline');
      },
      [1, 1],
      noWait,
    ),
    /offline/,
  );
  assert.equal(calls, 3);
});
