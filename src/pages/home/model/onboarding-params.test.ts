/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readOnboardingParams, safeNextPath } from './onboarding-params';

const read = (qs: string) => readOnboardingParams(new URLSearchParams(qs));

test('역할 없이 가입으로 오면 역할 선택부터', () => {
  assert.deepEqual(read('flow=sign-up'), { step: 'role', next: undefined });
});

test('역할이 있으면 가입 폼으로, next를 싣는다', () => {
  assert.deepEqual(read('flow=sign-up&role=tutor&next=%2Forg-invite%2Fabc'), {
    step: 'sign-up', role: 'TUTOR', classCode: undefined, next: '/org-invite/abc',
  });
});

test('외부로 튕기는 next는 버린다', () => {
  assert.equal(safeNextPath('//evil.com'), undefined);
  assert.equal(safeNextPath('/\\evil.com'), undefined);
  assert.equal(safeNextPath('https://evil.com'), undefined);
  assert.equal(safeNextPath('/ok path'), undefined);
  assert.equal(safeNextPath('/stories/HG'), '/stories/HG');
});

test('알 수 없는 flow는 null', () => {
  assert.equal(read('flow=x'), null);
});
