/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BETA_OPEN_ACCESS_NOTICE, subscriptionStatusLabel } from './glossary';

test('이용권 상태 라벨은 한 벌이다', () => {
  assert.equal(subscriptionStatusLabel('NONE'), '이용권 없음');
  assert.equal(subscriptionStatusLabel('TRIALING'), '체험 중');
  assert.equal(subscriptionStatusLabel('ACTIVE'), '이용 중');
  assert.equal(subscriptionStatusLabel('EXPIRED'), '만료됨');
});

test('베타 개방 안내 문구', () => {
  assert.equal(BETA_OPEN_ACCESS_NOTICE, '베타 기간에는 모든 이야기가 열려 있어요.');
});
