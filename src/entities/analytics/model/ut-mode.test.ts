/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { utModeForUrl } from './ut-mode';

test('ut=1 또는 traffic_type=ut 일 때만 UT 모드', () => {
  assert.equal(utModeForUrl('https://x.app/stories/HG/play?ut=1', false), true);
  assert.equal(utModeForUrl('https://x.app/?traffic_type=ut', false), true);
  assert.equal(utModeForUrl('https://x.app/?traffic_type=beta', false), false);
  assert.equal(utModeForUrl('https://x.app/', false), false);
  assert.equal(utModeForUrl(null, false), false);
});

test('한 번 켜진 값은 유지된다', () => {
  assert.equal(utModeForUrl('https://x.app/', true), true);
});
