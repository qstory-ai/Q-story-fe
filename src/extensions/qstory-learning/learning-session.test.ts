import assert from 'node:assert/strict';
import test from 'node:test';

import { ageBandFromAge } from './learning-session';

test('나이대는 서버와 같이 6세 이하 5-6, 7세 이상 7-9', () => {
  assert.equal(ageBandFromAge(4), '5-6');
  assert.equal(ageBandFromAge(6), '5-6');
  assert.equal(ageBandFromAge(7), '7-9');
  assert.equal(ageBandFromAge(11), '7-9');
});

test('모르거나 범위 밖이면 나이를 추측하지 않는다', () => {
  assert.equal(ageBandFromAge(null), 'UNKNOWN');
  assert.equal(ageBandFromAge(0), 'UNKNOWN');
  assert.equal(ageBandFromAge(40), 'UNKNOWN');
  assert.equal(ageBandFromAge(Number.NaN), 'UNKNOWN');
});
