// @ts-nocheck -- Node test assertions intentionally use test-only globals.
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
