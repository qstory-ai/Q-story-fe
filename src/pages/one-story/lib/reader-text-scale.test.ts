import assert from 'node:assert/strict';
import test from 'node:test';

import {
  defaultTextScale,
  nextTextScale,
  scaledText,
  textScaleFactor,
  textScaleLabel,
} from './reader-text-scale';

test('글씨 크기는 보통 → 크게 → 아주 크게 → 보통으로 돈다', () => {
  assert.equal(nextTextScale('normal'), 'large');
  assert.equal(nextTextScale('large'), 'xlarge');
  assert.equal(nextTextScale('xlarge'), 'normal');
  assert.equal(textScaleLabel('xlarge'), '아주 크게');
});

test('반 수업은 크게, 가정은 보통으로 시작한다', () => {
  assert.equal(defaultTextScale(true), 'large');
  assert.equal(defaultTextScale(false), 'normal');
});

test('scaledText는 글자 크기와 줄 높이만 배율만큼 키운다', () => {
  assert.deepEqual(scaledText({ fontSize: 16, lineHeight: 23 }, textScaleFactor('xlarge')), { fontSize: 24, lineHeight: 35 });
  assert.deepEqual(scaledText({ fontSize: 15 }, textScaleFactor('large')), { fontSize: 19 });
  assert.deepEqual(scaledText({ fontSize: 16, lineHeight: 23 }, 1), {});
});
