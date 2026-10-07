// @ts-nocheck -- Node 테스트 러너 타입은 Expo 번들에서 의도적으로 제외한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { countdownSeconds, createAutoConfirm } from './auto-confirm';

function fakeClock() {
  let t = 0;
  let nextId = 1;
  const timers = new Map();
  return {
    setTimeout: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { fn, at: t + ms });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    now: () => t,
    advance(ms) {
      t += ms;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= t) {
          timers.delete(id);
          timer.fn();
        }
      }
    },
  };
}

test('시간이 지나면 정확히 한 번 확인한다', () => {
  const clock = fakeClock();
  let calls = 0;
  const c = createAutoConfirm(2500, () => calls++, clock);
  c.start();
  clock.advance(2499);
  assert.equal(calls, 0);
  clock.advance(1);
  assert.equal(calls, 1);
  clock.advance(10_000);
  assert.equal(calls, 1);
  assert.equal(c.isActive(), false);
});

test('취소하면 확인하지 않는다', () => {
  const clock = fakeClock();
  let calls = 0;
  const c = createAutoConfirm(2500, () => calls++, clock);
  c.start();
  clock.advance(1000);
  c.cancel();
  clock.advance(10_000);
  assert.equal(calls, 0);
});

test('다시 start 해도 한 번만 확인한다', () => {
  const clock = fakeClock();
  let calls = 0;
  const c = createAutoConfirm(2500, () => calls++, clock);
  c.start();
  clock.advance(1000);
  c.start();
  clock.advance(2499);
  assert.equal(calls, 0);
  clock.advance(1);
  assert.equal(calls, 1);
});

test('남은 시간과 초 표시', () => {
  const clock = fakeClock();
  const c = createAutoConfirm(2500, () => {}, clock);
  assert.equal(c.remainingMs(), 0);
  c.start();
  clock.advance(500);
  assert.equal(c.remainingMs(), 2000);
  assert.equal(countdownSeconds(2000), 2);
  assert.equal(countdownSeconds(2500), 3);
  assert.equal(countdownSeconds(0), 0);
});
