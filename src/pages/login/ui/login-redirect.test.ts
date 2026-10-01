/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loginRedirectPath } from './login-redirect';

test('next를 로그인 흐름으로 넘긴다', () => {
  assert.equal(loginRedirectPath('?next=%2Fstories%2FP1'), '/?flow=sign-in&next=%2Fstories%2FP1');
});

test('next가 없으면 그대로', () => {
  assert.equal(loginRedirectPath(''), '/?flow=sign-in');
});
