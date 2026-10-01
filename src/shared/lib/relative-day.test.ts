/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { relativeDayLabel } from './relative-day';

const now = new Date(2026, 9, 1, 9, 0); // 2026-10-01 09:00 (로컬)

test('같은 날은 오늘', () => {
  assert.equal(relativeDayLabel(new Date(2026, 9, 1, 0, 5).toISOString(), now), '오늘');
});

test('달력상 전날은 시간 차이와 상관없이 어제', () => {
  assert.equal(relativeDayLabel(new Date(2026, 8, 30, 23, 50).toISOString(), now), '어제');
});

test('그 이전은 N일 전에', () => {
  assert.equal(relativeDayLabel(new Date(2026, 8, 27, 12, 0).toISOString(), now), '4일 전에');
});

test('미래·잘못된 값은 오늘로 접는다', () => {
  assert.equal(relativeDayLabel(new Date(2026, 9, 2).toISOString(), now), '오늘');
  assert.equal(relativeDayLabel('not-a-date', now), '오늘');
});
