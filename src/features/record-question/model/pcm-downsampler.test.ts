// @ts-nocheck -- Node 테스트 러너 타입을 의도적으로 Expo 번들에서 제외한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { STREAM_FRAME_SAMPLES, createPcmDownsampler } from './pcm-downsampler';

test('48kHz input becomes 100ms frames of 16kHz samples', () => {
  const frames: Int16Array[] = [];
  const downsampler = createPcmDownsampler(48_000, (frame) => frames.push(frame));
  // 1초 = 48,000 샘플을 10ms(480 샘플)씩 넣는다 - 오디오 콜백처럼.
  for (let chunk = 0; chunk < 100; chunk += 1) {
    downsampler.push(new Float32Array(480).fill(0.5));
  }
  assert.equal(frames.length, 10);
  assert.ok(frames.every((frame) => frame.length === STREAM_FRAME_SAMPLES));
  assert.equal(frames[0][0], Math.trunc(0.5 * 0x7fff));
});

test('44.1kHz input keeps the right number of output samples', () => {
  let total = 0;
  const downsampler = createPcmDownsampler(44_100, (frame) => {
    total += frame.length;
  });
  downsampler.push(new Float32Array(44_100));
  downsampler.flush();
  assert.ok(Math.abs(total - 16_000) <= 1, `got ${total}`);
});

test('samples are clamped and negative full scale maps to -32768', () => {
  const frames: Int16Array[] = [];
  const downsampler = createPcmDownsampler(16_000, (frame) => frames.push(frame));
  downsampler.push(new Float32Array([-1, 1, 2, -3]));
  downsampler.flush();
  assert.deepEqual(Array.from(frames[0]), [-32768, 32767, 32767, -32768]);
});

test('flush emits the remaining partial frame once', () => {
  const frames: Int16Array[] = [];
  const downsampler = createPcmDownsampler(16_000, (frame) => frames.push(frame));
  downsampler.push(new Float32Array(100));
  downsampler.flush();
  downsampler.flush();
  assert.equal(frames.length, 1);
  assert.equal(frames[0].length, 100);
});
