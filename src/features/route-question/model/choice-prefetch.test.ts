// @ts-nocheck -- Node 테스트 assertion들이 테스트 전용 전역 변수를 의도적으로 사용한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createChoicePrefetcher,
  isPrefetchDisabledBody,
  PrefetchDisabledError,
} from './choice-prefetch';

const items = [
  { id: 'OPTION_1', text: 'a' },
  { id: 'OPTION_2', text: 'b' },
  { id: 'OPTION_3', text: 'c' },
];
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('cache hit returns audio once without any further fetch', async () => {
  let calls = 0;
  const p = createChoicePrefetcher({
    fetcher: async (item) => {
      calls += 1;
      return `audio-${item.id}`;
    },
  });
  p.start(items);
  await tick();
  assert.equal(calls, 3);
  assert.deepEqual(p.take('OPTION_2'), { audio: 'audio-OPTION_2', pending: null });
  assert.equal(p.take('OPTION_2'), null);
  assert.equal(calls, 3);
});

test('pending take survives abort and resolves via awaitTaken', async () => {
  let resolve;
  const p = createChoicePrefetcher({
    fetcher: () => new Promise((r) => { resolve = r; }),
  });
  p.start([items[0]]);
  const taken = p.take('OPTION_1');
  assert.equal(taken.audio, null);
  p.abort();
  resolve('late-ok');
  assert.equal((await p.awaitTaken(taken, 100)).audio, 'late-ok');
});

test('pending failure resolves null so caller falls back', async () => {
  const p = createChoicePrefetcher({
    fetcher: async () => {
      throw new Error('x');
    },
  });
  p.start([items[0]]);
  const taken = p.take('OPTION_1');
  const result = await p.awaitTaken(taken, 100);
  assert.equal(result.audio, null);
  assert.equal(result.timedOut, false);
  assert.ok(result.elapsedMs < 100);
});

test('timeout returns null and disposes the late result', async () => {
  let resolve;
  const disposed = [];
  const p = createChoicePrefetcher({
    fetcher: () => new Promise((r) => { resolve = r; }),
    dispose: (a) => disposed.push(a),
  });
  p.start([items[0]]);
  const taken = p.take('OPTION_1');
  const result = await p.awaitTaken(taken, 5);
  assert.equal(result.audio, null);
  assert.equal(result.timedOut, true);
  assert.ok(result.elapsedMs < 100);
  resolve('late');
  await tick();
  assert.deepEqual(disposed, ['late']);
});

test('real FailureBody shape is recognised as PREFETCH_DISABLED', () => {
  assert.equal(
    isPrefetchDisabledBody({
      ok: false,
      failure: { code: 'PREFETCH_DISABLED', stage: 'narration', retryable: false },
    }),
    true,
  );
  assert.equal(isPrefetchDisabledBody({ code: 'PREFETCH_DISABLED' }), true);
  assert.equal(isPrefetchDisabledBody({ ok: false, failure: { code: 'OTHER' } }), false);
  assert.equal(isPrefetchDisabledBody(null), false);
});

test('409 disables prefetch for the rest of the session', async () => {
  let calls = 0;
  const p = createChoicePrefetcher({
    fetcher: async () => {
      calls += 1;
      throw new PrefetchDisabledError();
    },
  });
  p.start(items);
  await tick();
  assert.equal(p.isDisabled(), true);
  const before = calls;
  p.start(items);
  await tick();
  assert.equal(calls, before);
});

test('other failures are not retried and do not disable', async () => {
  let calls = 0;
  const p = createChoicePrefetcher({
    fetcher: async () => {
      calls += 1;
      return null;
    },
  });
  p.start(items);
  await tick();
  assert.equal(p.isDisabled(), false);
  assert.equal(calls, 3);
});

test('abort cancels pending requests and disposes ready audio', async () => {
  const signals = [];
  const disposed = [];
  const p = createChoicePrefetcher({
    fetcher: (item, signal) => {
      signals.push(signal);
      return item.id === 'OPTION_1' ? Promise.resolve('ready') : new Promise(() => {});
    },
    dispose: (a) => disposed.push(a),
  });
  p.start(items);
  await tick();
  p.abort();
  assert.equal(signals.every((s) => s.aborted), true);
  assert.deepEqual(disposed, ['ready']);
  assert.equal(p.take('OPTION_1'), null);
});

test('taken audio is not aborted by later abort', async () => {
  let signal;
  const p = createChoicePrefetcher({
    fetcher: async (_i, s) => {
      signal = s;
      return 'x';
    },
  });
  p.start([items[0]]);
  await tick();
  assert.equal(p.take('OPTION_1').audio, 'x');
  p.abort();
  assert.equal(signal.aborted, false);
});
