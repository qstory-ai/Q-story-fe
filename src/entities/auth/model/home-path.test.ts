/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { UserSummary } from '../api/auth-api';
import { homePathForAuth, libraryPathFor, subscriptionPathFor } from './home-path';

const user = (role: UserSummary['role']) => ({ role } as UserSummary);

test('로그인 상태면 역할 홈, 아니면 /', () => {
  assert.equal(homePathForAuth({ status: 'authenticated', token: 't', user: user('PARENT') }), '/parent');
  assert.equal(homePathForAuth({ status: 'anonymous' }), '/');
  assert.equal(homePathForAuth({ status: 'loading' }), '/');
});

test('역할별 서재·이용권 경로', () => {
  assert.equal(libraryPathFor(user('PARENT')), '/library');
  assert.equal(libraryPathFor(user('TUTOR')), '/tutor/library');
  assert.equal(libraryPathFor(user('DIRECTOR')), '/organization');
  assert.equal(subscriptionPathFor(user('DIRECTOR')), '/organization/subscription');
  assert.equal(subscriptionPathFor(user('PARENT')), '/mypage/subscription');
});
