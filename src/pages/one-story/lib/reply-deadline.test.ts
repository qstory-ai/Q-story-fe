// @ts-nocheck -- Node 테스트 러너 타입은 Expo 번들에서 의도적으로 제외한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  REPLY_TIMEOUT_CODE,
  STT_BATCH_TIMEOUT_MS,
  STT_TIMEOUT_CHILD_COPY,
  STT_TIMEOUT_CODE,
  createReplyDeadline,
  isReplyTimeout,
  isTimeoutCode,
} from './reply-deadline';

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
    pending: () => timers.size,
  };
}

/** 약속이 끝났는지 지켜본다 - 마이크로태스크를 한 바퀴 돌린 뒤 state를 읽는다. */
function watch(promise) {
  const status = { state: 'pending', error: null };
  promise.then(
    () => {
      status.state = 'resolved';
    },
    (error) => {
      status.state = 'rejected';
      status.error = error;
    },
  );
  return status;
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('답 문장이 안 오면 firstMs 뒤에 REPLY_TIMEOUT으로 거부한다', async () => {
  const clock = fakeClock();
  const deadline = createReplyDeadline({ firstMs: 1_000, restMs: 500 }, clock);
  const status = watch(deadline.expired);
  clock.advance(999);
  await flush();
  assert.equal(status.state, 'pending');
  assert.equal(deadline.expiredAlready(), false);
  clock.advance(1);
  await flush();
  assert.equal(status.state, 'rejected');
  assert.ok(isReplyTimeout(status.error));
  assert.equal(status.error.code, REPLY_TIMEOUT_CODE);
  assert.equal(status.error.retryable, true);
  assert.equal(deadline.expiredAlready(), true);
});

test('답 문장이 오면 restMs를 다시 재고, 그 안에 끝나면 거부하지 않는다', async () => {
  const clock = fakeClock();
  const deadline = createReplyDeadline({ firstMs: 1_000, restMs: 500 }, clock);
  const status = watch(deadline.expired);
  clock.advance(900);
  deadline.textArrived();
  // firstMs 기준이었으면 여기서 끝났을 시간.
  clock.advance(100);
  await flush();
  assert.equal(status.state, 'pending');
  clock.advance(399);
  await flush();
  assert.equal(status.state, 'pending');
  deadline.clear();
  clock.advance(10_000);
  await flush();
  assert.equal(status.state, 'pending');
  assert.equal(clock.pending(), 0);
});

test('답 문장 뒤 나머지가 restMs 안에 안 오면 거부한다', async () => {
  const clock = fakeClock();
  const deadline = createReplyDeadline({ firstMs: 1_000, restMs: 500 }, clock);
  const status = watch(deadline.expired);
  deadline.textArrived();
  clock.advance(500);
  await flush();
  assert.equal(status.state, 'rejected');
  assert.ok(isReplyTimeout(status.error));
});

test('clear 뒤에는 textArrived를 불러도 다시 재지 않는다', async () => {
  const clock = fakeClock();
  const deadline = createReplyDeadline({ firstMs: 1_000, restMs: 500 }, clock);
  const status = watch(deadline.expired);
  deadline.clear();
  deadline.textArrived();
  assert.equal(clock.pending(), 0);
  clock.advance(10_000);
  await flush();
  assert.equal(status.state, 'pending');
  assert.equal(deadline.expiredAlready(), false);
});

test('Promise.race로 묶으면 느린 요청 대신 시간 제한이 이긴다', async () => {
  const clock = fakeClock();
  const deadline = createReplyDeadline({ firstMs: 1_000, restMs: 500 }, clock);
  const slow = new Promise(() => {});
  const race = Promise.race([slow, deadline.expired]);
  clock.advance(1_000);
  await assert.rejects(race, (error) => isReplyTimeout(error));
});

test('코드와 문구를 바꾸면(배치 STT) 그 코드로 거부하고, 답 시간 제한으로는 보지 않는다', async () => {
  const clock = fakeClock();
  const deadline = createReplyDeadline(
    { firstMs: STT_BATCH_TIMEOUT_MS, code: STT_TIMEOUT_CODE, message: STT_TIMEOUT_CHILD_COPY },
    clock,
  );
  const status = watch(deadline.expired);
  clock.advance(STT_BATCH_TIMEOUT_MS);
  await flush();
  assert.equal(status.state, 'rejected');
  assert.ok(isTimeoutCode(status.error, STT_TIMEOUT_CODE));
  assert.equal(isReplyTimeout(status.error), false);
  assert.equal(status.error.message, STT_TIMEOUT_CHILD_COPY);
});

test('isReplyTimeout은 다른 오류를 시간 제한으로 보지 않는다', () => {
  assert.equal(isReplyTimeout(new Error('x')), false);
  assert.equal(isReplyTimeout(null), false);
});
