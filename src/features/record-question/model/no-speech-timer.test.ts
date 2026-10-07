import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createNoSpeechTimer, type NoSpeechClock } from './no-speech-timer';

function fakeClock() {
  let now = 0;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const clock: NoSpeechClock = {
    now: () => now,
    setTimeout: (fn, ms) => {
      seq += 1;
      timers.set(seq, { at: now + ms, fn });
      return seq;
    },
    clearTimeout: (handle) => {
      timers.delete(handle as number);
    },
  };
  function advance(ms: number) {
    const target = now + ms;
    for (;;) {
      const next = [...timers.entries()]
        .filter(([, timer]) => timer.at <= target)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      timers.delete(next[0]);
      now = next[1].at;
      next[1].fn();
    }
    now = target;
  }
  return { clock, advance, pending: () => timers.size };
}

function setup() {
  const { clock, advance, pending } = fakeClock();
  const calls: string[] = [];
  const timer = createNoSpeechTimer(
    {
      onReprompt: () => calls.push('reprompt'),
      onGiveUp: () => calls.push('give-up'),
    },
    { firstWaitMs: 15_000, secondWaitMs: 15_000 },
    clock,
  );
  return { timer, advance, calls, pending };
}

test('15초 동안 말이 없으면 한 번 다시 묻고, 15초 더 없으면 포기한다', () => {
  const { timer, advance, calls } = setup();
  timer.start();
  advance(14_999);
  assert.deepEqual(calls, []);
  advance(1);
  assert.deepEqual(calls, ['reprompt']);
  advance(14_999);
  assert.deepEqual(calls, ['reprompt']);
  advance(1);
  assert.deepEqual(calls, ['reprompt', 'give-up']);
  advance(60_000);
  assert.deepEqual(calls, ['reprompt', 'give-up']);
});

test('말소리가 들리면 다시 묻지도 포기하지도 않는다', () => {
  const { timer, advance, calls, pending } = setup();
  timer.start();
  advance(5_000);
  timer.speechDetected();
  advance(60_000);
  assert.deepEqual(calls, []);
  assert.equal(pending(), 0);
});

test('다시 물은 뒤 말하면 포기하지 않는다', () => {
  const { timer, advance, calls } = setup();
  timer.start();
  advance(15_000);
  timer.speechDetected();
  advance(60_000);
  assert.deepEqual(calls, ['reprompt']);
});

test('취소하면 아무 것도 부르지 않는다', () => {
  const { timer, advance, calls, pending } = setup();
  timer.start();
  advance(3_000);
  timer.cancel();
  advance(60_000);
  assert.deepEqual(calls, []);
  assert.equal(pending(), 0);
});

test('start를 두 번 불러도 타이머는 하나만 돈다', () => {
  const { timer, advance, calls } = setup();
  timer.start();
  advance(10_000);
  timer.start();
  advance(30_000);
  assert.deepEqual(calls, ['reprompt', 'give-up']);
});
