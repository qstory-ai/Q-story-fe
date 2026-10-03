/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { UserSummary } from '../api/auth-api';
import { homePathForAuth, libraryPathFor, reportsPathFor, subscriptionPathFor } from './home-path';

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

test('역할별 리포트 목록 - 관리자는 합친 기관 리포트로', () => {
  assert.equal(reportsPathFor(user('PARENT')), '/reports');
  assert.equal(reportsPathFor(user('TUTOR')), '/tutor/reports');
  assert.equal(reportsPathFor(user('DIRECTOR')), '/organization/reports');
});
