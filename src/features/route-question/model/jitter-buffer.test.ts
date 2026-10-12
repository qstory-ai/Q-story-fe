// @ts-nocheck -- Node 테스트 assertion들이 테스트 전용 전역 변수를 의도적으로 사용한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  estimateArrivalRate,
  estimateReplySpeechSeconds,
  JITTER_RESUME_MIN_SECONDS,
  JITTER_START_MAX_WAIT_SECONDS,
  requiredBufferSeconds,
  shouldStartPlayback,
} from './jitter-buffer';

const base = {
  phase: 'start',
  bufferedSeconds: 0,
  receivedSeconds: 0,
  sinceFirstChunkSeconds: 0,
  waitingSeconds: 0,
  estimatedTotalSeconds: 10,
  streamEnded: false,
  coveredByFiller: false,
};

test('빠르게 오면(실시간 2배) 최소 0.6초만 모으고 시작한다', () => {
  const state = { ...base, bufferedSeconds: 0.62, receivedSeconds: 0.62, sinceFirstChunkSeconds: 0.3, waitingSeconds: 0.3 };
  assert.equal(requiredBufferSeconds(state), 0.6);
  assert.equal(shouldStartPlayback(state), true);
  assert.equal(shouldStartPlayback({ ...state, bufferedSeconds: 0.4, receivedSeconds: 0.4 }), false);
});

test('느리게 오면(실시간 0.5배) 남은 분량의 부족분만큼 더 모은다', () => {
  // 2초에 1초 분량 - 남은 9초를 재생하는 동안 절반 남짓만 들어온다.
  const state = { ...base, bufferedSeconds: 1, receivedSeconds: 1, sinceFirstChunkSeconds: 2, waitingSeconds: 2 };
  const rate = estimateArrivalRate(1, 2);
  assert.ok(rate < 0.5);
  assert.ok(Math.abs(requiredBufferSeconds(state) - (9 * (1 - rate) + 0.3)) < 1e-9);
  assert.equal(shouldStartPlayback(state), false);
});

test('첫 조각 뒤 2.5초가 지나면 덜 모였어도 시작한다 - 채움말이 나오는 동안은 미룬다', () => {
  const late = { ...base, bufferedSeconds: 1.2, receivedSeconds: 1.2, sinceFirstChunkSeconds: 2.5, waitingSeconds: JITTER_START_MAX_WAIT_SECONDS };
  assert.equal(shouldStartPlayback(late), true);
  assert.equal(shouldStartPlayback({ ...late, coveredByFiller: true }), false);
});

test('채움말이 나오는 중이어도 충분히 모였으면 바로 시작한다(답을 늦추지 않는다)', () => {
  const ready = { ...base, bufferedSeconds: 0.8, receivedSeconds: 0.8, sinceFirstChunkSeconds: 0.2, waitingSeconds: 0.2, coveredByFiller: true };
  assert.equal(shouldStartPlayback(ready), true);
});

test('스트림이 끝났으면 남은 걸 바로 튼다, 아무것도 없으면 시작하지 않는다', () => {
  assert.equal(shouldStartPlayback({ ...base, bufferedSeconds: 0.1, receivedSeconds: 3, streamEnded: true }), true);
  assert.equal(shouldStartPlayback({ ...base, bufferedSeconds: 0, receivedSeconds: 3, streamEnded: true }), false);
});

test('끊긴 뒤에는 0.8초 이상 다시 모일 때까지 토막을 틀지 않는다(상한이 지나도)', () => {
  const resume = {
    ...base,
    phase: 'resume',
    bufferedSeconds: 0.5,
    receivedSeconds: 9.5,
    sinceFirstChunkSeconds: 10,
    waitingSeconds: 10,
  };
  assert.equal(shouldStartPlayback(resume), false);
  assert.equal(shouldStartPlayback({ ...resume, bufferedSeconds: JITTER_RESUME_MIN_SECONDS }), true);
  assert.equal(shouldStartPlayback({ ...resume, streamEnded: true }), true);
});

test('문장 길이를 모르면 남은 분량을 4초로 본다', () => {
  const state = { ...base, estimatedTotalSeconds: null, bufferedSeconds: 0.3, receivedSeconds: 0.3, sinceFirstChunkSeconds: 0.5 };
  const rate = estimateArrivalRate(0.3, 0.5);
  assert.ok(Math.abs(requiredBufferSeconds(state) - (4 * (1 - rate) + 0.3)) < 1e-9);
});

test('그레텔 답 길이 어림 - 운영 실측(39자 10.5~10.9초, 51자 10.9초) 근처', () => {
  const a = estimateReplySpeechSeconds('응, 나도 그 과자집이 정말 궁금했어! 그런데 마녀가 왜 아이들을 집에 들였을까? 너는 어떻게 생각해?');
  const b = estimateReplySpeechSeconds(
    '우와, 좋은 생각이야! 헨젤이 하얀 조약돌을 떨어뜨린 건 집에 돌아가는 길을 찾으려고 그랬던 거야. 너라면 무엇을 떨어뜨릴 거야?',
  );
  assert.ok(a > 9.5 && a < 11.5, String(a));
  assert.ok(b > 10 && b < 14, String(b));
  assert.ok(estimateReplySpeechSeconds('응!') < 1.5);
});

/**
 * 재생기(playPcmStream)의 판단을 흉내 낸다 - 40ms 조각이 speed배 실시간으로 오고, 25ms마다 상태를 본다.
 * 재생 중 남은 소리가 0.06초 아래로 떨어지면 멈추고(phase resume), 다시 시작 조건을 기다린다.
 */
function simulate(speed: number, totalSeconds = 10, estimate = totalSeconds, coveredUntil = 0) {
  const chunk = 0.04;
  const tick = 0.005;
  let received = 0;
  let pending = 0;
  let playing = false;
  let phase = 'start';
  let playheadEnd = 0;
  let waitFrom = 0;
  let firstSound = null;
  const stalls = [];
  let stallFrom = 0;
  let nextTick = 0;
  for (let t = 0; t < 120; t += tick) {
    while (received < totalSeconds - 1e-9 && received / speed <= t + 1e-9) {
      received += chunk;
      pending += chunk;
    }
    const ended = received >= totalSeconds - 1e-9;
    if (playing) {
      if (pending > 0) {
        playheadEnd = Math.max(playheadEnd, t) + pending;
        pending = 0;
      }
      if (t + 1e-9 >= nextTick) {
        nextTick = t + 0.025;
        if (!ended && playheadEnd - t < 0.06) {
          playing = false;
          phase = 'resume';
          stallFrom = playheadEnd;
          waitFrom = playheadEnd;
        }
      }
      if (ended && pending === 0 && t >= playheadEnd) break;
      continue;
    }
    const start = shouldStartPlayback({
      phase,
      bufferedSeconds: pending,
      receivedSeconds: received,
      sinceFirstChunkSeconds: t,
      waitingSeconds: Math.max(0, t - waitFrom),
      estimatedTotalSeconds: estimate,
      streamEnded: ended,
      coveredByFiller: t < coveredUntil,
    });
    if (!start) continue;
    if (firstSound === null) firstSound = t;
    else stalls.push(t - stallFrom);
    playing = true;
    playheadEnd = t + pending;
    pending = 0;
    nextTick = t + 0.025;
  }
  return { firstSound, stalls };
}

test('시뮬레이션: 2배·1.2배는 끊김 없이, 첫 소리는 빠르게', () => {
  for (const speed of [2, 1.2]) {
    const { firstSound, stalls } = simulate(speed);
    assert.equal(stalls.length, 0, `speed ${speed}`);
    assert.ok(firstSound < 0.8, `speed ${speed} first ${firstSound}`);
  }
});

test('시뮬레이션: 0.8배는 2.5초 안에 시작하고 끊김은 한 번 이하', () => {
  const { firstSound, stalls } = simulate(0.8);
  assert.ok(firstSound <= 2.5 + 0.03, String(firstSound));
  assert.ok(stalls.length <= 1, JSON.stringify(stalls));
});

test('시뮬레이션: 0.5배는 2.5초에 시작하고, 끊기면 0.8초 이상 모아 이어 튼다(짧은 토막 반복 없음)', () => {
  const { firstSound, stalls } = simulate(0.5);
  assert.ok(Math.abs(firstSound - 2.5) < 0.05, String(firstSound));
  assert.ok(stalls.length <= 5, JSON.stringify(stalls));
  // 마지막 끊김은 스트림이 끝나 남은 걸 바로 틀 수 있다.
  for (const stall of stalls.slice(0, -1)) assert.ok(stall >= JITTER_RESUME_MIN_SECONDS / 0.5 - 0.1, String(stall));
});

test('시뮬레이션: 채움말이 3초까지 나오면 0.8배도 그동안 더 모아 끊김이 줄어든다', () => {
  const covered = simulate(0.8, 10, 10, 3);
  assert.ok(covered.firstSound >= 2.5, String(covered.firstSound));
  assert.ok(covered.stalls.length <= simulate(0.8).stalls.length);
});
