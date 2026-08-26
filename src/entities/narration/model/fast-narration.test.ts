// @ts-nocheck -- Node 테스트 단정문이 의도적으로 테스트 전용 전역을 사용한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { audioReadyWithin } from './fast-narration';

test('uses narration audio that is already ready', async () => {
  const audio = { mimeType: 'audio/wav', dataBase64: 'AQID' };
  assert.equal(await audioReadyWithin(Promise.resolve(audio), 50), audio);
});

test('returns quickly when remote narration is still being generated', async () => {
  const startedAt = Date.now();
  const result = await audioReadyWithin(
    new Promise(() => {}),
    5,
  );

  assert.equal(result, null);
  assert.ok(Date.now() - startedAt < 1_000);
});
