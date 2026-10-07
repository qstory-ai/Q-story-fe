// @ts-nocheck -- Node 테스트 러너 타입은 Expo 번들에서 의도적으로 제외한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { TurnRecorder } from './turn-recorder';

const CONTEXT = { storyId: 'HG', contentVersion: 'v1' };

function manualTimers() {
  const pending = [];
  return {
    schedule: (callback) => {
      const timer = { callback };
      pending.push(timer);
      return timer;
    },
    cancel: (timer) => {
      const index = pending.indexOf(timer);
      if (index >= 0) pending.splice(index, 1);
    },
    fire: () => {
      const due = pending.splice(0);
      due.forEach((timer) => timer.callback());
    },
    get count() {
      return pending.length;
    },
  };
}

test('turns get increasing seq and are sent together after the debounce', async () => {
  const sent = [];
  const timers = manualTimers();
  const recorder = new TurnRecorder('s1', CONTEXT, {
    send: async (sessionId, batch) => sent.push({ sessionId, batch }),
    schedule: timers.schedule,
    cancel: timers.cancel,
  });
  recorder.record({ role: 'CHARACTER', sceneId: 'HG-F04', text: '저 새를 보니 궁금한 게 있어?', fixed: true });
  recorder.record({ role: 'CHILD', sceneId: 'HG-F04', text: '새는 어디 가?', speaker: 'UNVERIFIED' });
  assert.equal(sent.length, 0);
  assert.equal(timers.count, 1, 'debounce keeps a single pending timer');
  timers.fire();
  await recorder.flush();
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].batch.turns.map((turn) => turn.seq), [1, 2]);
  assert.equal(sent[0].batch.storyId, 'HG');
  assert.equal(recorder.pendingCount, 0);
  assert.equal(recorder.nextSeq, 3);
});

test('a failed send keeps the turns and retries them with the same seq', async () => {
  let fail = true;
  const sent = [];
  const timers = manualTimers();
  const recorder = new TurnRecorder('s1', CONTEXT, {
    send: async (_sessionId, batch) => {
      if (fail) throw new Error('offline');
      sent.push(batch.turns.map((turn) => turn.seq));
    },
    schedule: timers.schedule,
    cancel: timers.cancel,
  });
  recorder.record({ role: 'CHILD', sceneId: 'HG-F05', text: '왜 과자로 만들었어요?' });
  await recorder.flush();
  assert.equal(recorder.pendingCount, 1);
  fail = false;
  recorder.record({ role: 'CHARACTER', sceneId: 'HG-F05', text: '그건 나도 궁금해.' });
  await recorder.flush();
  assert.deepEqual(sent, [[1, 2]]);
  assert.equal(recorder.pendingCount, 0);
});

test('large queues are split into batches of at most the limit', async () => {
  const sizes = [];
  const recorder = new TurnRecorder('s1', CONTEXT, {
    send: async (_sessionId, batch) => sizes.push(batch.turns.length),
    schedule: () => null,
    cancel: () => {},
    batchLimit: 50,
  });
  for (let index = 0; index < 120; index += 1) recorder.record({ role: 'SYSTEM', sceneId: 'HG-F01', event: 'INVITE_SKIPPED' });
  await recorder.flush();
  assert.deepEqual(sizes, [50, 50, 20]);
});

test('resuming a saved session continues its seq instead of starting over', async () => {
  const sent = [];
  const recorder = new TurnRecorder('fresh', CONTEXT, {
    send: async (sessionId, batch) => sent.push([sessionId, batch.turns.map((turn) => turn.seq)]),
    schedule: () => null,
    cancel: () => {},
  });
  recorder.startSession('saved-session', 8);
  recorder.record({ role: 'CHILD', sceneId: 'HG-F07', text: '헨젤이 마녀를 부르면 되잖아' });
  await recorder.flush();
  assert.deepEqual(sent, [['saved-session', [8]]]);
  // 같은 회차를 다시 이어도(같거나 작은 seq) 번호를 되돌리지 않는다.
  recorder.startSession('saved-session', 3);
  assert.equal(recorder.nextSeq, 9);
});

test('a disabled recorder (no account) keeps history for the live report but sends nothing', async () => {
  let calls = 0;
  const recorder = new TurnRecorder('demo', CONTEXT, { send: async () => { calls += 1; } }, false);
  recorder.record({ role: 'CHILD', sceneId: 'HG-F04', text: 'x'.repeat(800) });
  await recorder.flush();
  assert.equal(calls, 0);
  assert.equal(recorder.history.length, 1);
  assert.equal(recorder.history[0].text.length, 500);
});

test('starting a new session still sends what was left of the previous one under its own id', async () => {
  const sent = [];
  const recorder = new TurnRecorder('first', CONTEXT, {
    send: async (sessionId, batch) => sent.push([sessionId, batch.turns.map((turn) => turn.seq)]),
    schedule: () => null,
    cancel: () => {},
  });
  recorder.record({ role: 'CHILD', sceneId: 'HG-F10', text: '끝났다!' });
  recorder.startSession('second', 1);
  recorder.record({ role: 'CHILD', sceneId: 'HG-F01', text: '다시 읽자' });
  await recorder.flush();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(sent.sort(), [['first', [1]], ['second', [1]]]);
});

test('UT 회차 조건과 답 시간·실패 코드가 묶음에 함께 간다(Q-40)', async () => {
  const sent = [];
  const timers = manualTimers();
  const recorder = new TurnRecorder('s-ut', CONTEXT, {
    send: async (sessionId, batch) => sent.push({ sessionId, batch }),
    schedule: timers.schedule,
    cancel: timers.cancel,
  });
  recorder.setContext({
    entrySource: 'lesson',
    playSetting: 'SMALL_GROUP',
    devicePlatform: 'tablet',
    deviceBrowser: 'safari',
    viewportClass: 'regular',
  });
  recorder.record({ role: 'CHILD', sceneId: 'HG-F04', text: '새는 어디 가?', speaker: 'UNVERIFIED' });
  recorder.record({ role: 'CHARACTER', sceneId: 'HG-F04', text: '숲 쪽으로 날아가.', latencyMs: 1830 });
  recorder.record({ role: 'SYSTEM', sceneId: 'HG-F04', event: 'REPLY_FAILED', errorCode: 'TIMEOUT' });
  recorder.record({ role: 'SYSTEM', sceneId: 'HG-F04', event: 'STT_FAILED', errorCode: 'NO_RECORDING' });
  timers.fire();
  await Promise.resolve();

  assert.equal(sent.length, 1);
  const { batch } = sent[0];
  assert.equal(batch.entrySource, 'lesson');
  assert.equal(batch.playSetting, 'SMALL_GROUP');
  assert.equal(batch.devicePlatform, 'tablet');
  assert.equal(batch.deviceBrowser, 'safari');
  assert.equal(batch.viewportClass, 'regular');
  assert.equal(batch.turns[1].latencyMs, 1830);
  assert.deepEqual(
    batch.turns.slice(2).map((turn) => [turn.event, turn.errorCode]),
    [
      ['REPLY_FAILED', 'TIMEOUT'],
      ['STT_FAILED', 'NO_RECORDING'],
    ],
  );
});

test('flush with no lines still creates the session once (Q-40 UT session code)', async () => {
  const sent = [];
  const recorder = new TurnRecorder('s-empty', { storyId: 'HG' }, {
    send: async (sessionId, body) => { sent.push({ sessionId, count: body.turns.length }); },
    schedule: () => 0,
    cancel: () => {},
  });
  await recorder.flush();
  await recorder.flush();
  assert.deepEqual(sent, [{ sessionId: 's-empty', count: 0 }]);
  recorder.startSession('s-next');
  await recorder.flush();
  assert.deepEqual(sent.at(-1), { sessionId: 's-next', count: 0 });
});
