import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createSilenceDetector, type SilenceDecision } from './silence-detector';

const FRAME_MS = 100;
const NOISE = 0.01;
const SPEECH = 0.2;

/** [지속 ms, rms] 구간들을 100ms 프레임으로 흘려 보내고, 'stop'이 처음 나온 시각을 돌려준다. */
function run(segments: Array<[number, number]>) {
  const detector = createSilenceDetector();
  let at = 0;
  let stopAt: number | null = null;
  for (const [durationMs, rms] of segments) {
    const end = at + durationMs;
    while (at < end) {
      at += FRAME_MS;
      const decision: SilenceDecision = detector.push({ atMs: at, rms });
      if (decision === 'stop' && stopAt === null) stopAt = at;
    }
  }
  return { stopAt, heardSpeech: detector.heardSpeech() };
}

test('말 중간에 0.8초 쉬어도 녹음을 끊지 않는다', () => {
  const { stopAt, heardSpeech } = run([
    [500, NOISE],
    [1_000, SPEECH],
    [800, NOISE],
    [1_000, SPEECH],
    [1_000, NOISE],
  ]);
  assert.equal(heardSpeech, true);
  assert.equal(stopAt, null);
});

test('말한 뒤 1.5초 조용하면 끝낸다', () => {
  const { stopAt } = run([
    [500, NOISE],
    [1_000, SPEECH],
    [2_000, NOISE],
  ]);
  // 마지막 말소리 프레임은 1500ms, 그 뒤 1.5초가 지난 3000ms에 끝난다.
  assert.equal(stopAt, 3_000);
});

test('일정한 주변 소음만 있으면 끝내지 않는다(30초 상한에 맡긴다)', () => {
  const { stopAt, heardSpeech } = run([[30_000, 0.05]]);
  assert.equal(heardSpeech, false);
  assert.equal(stopAt, null);
});

test('조금 흔들리는 소음도 말로 보지 않는다', () => {
  const detector = createSilenceDetector();
  let stopped = false;
  for (let at = FRAME_MS; at <= 30_000; at += FRAME_MS) {
    const rms = 0.04 + (Math.floor(at / FRAME_MS) % 3) * 0.01;
    if (detector.push({ atMs: at, rms }) === 'stop') stopped = true;
  }
  assert.equal(stopped, false);
  assert.equal(detector.heardSpeech(), false);
});

test('0.4초보다 짧은 소리(기침·톡)는 말로 치지 않는다', () => {
  const { stopAt, heardSpeech } = run([
    [500, NOISE],
    [300, SPEECH],
    [3_000, NOISE],
  ]);
  assert.equal(heardSpeech, false);
  assert.equal(stopAt, null);
});

test('녹음 시작 직후부터 말해도 소음 기준이 너무 높아지지 않아 말을 알아챈다', () => {
  const { stopAt, heardSpeech } = run([
    [1_200, SPEECH],
    [2_000, NOISE],
  ]);
  assert.equal(heardSpeech, true);
  assert.notEqual(stopAt, null);
});
