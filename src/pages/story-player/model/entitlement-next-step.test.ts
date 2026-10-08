/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { AuthState, UserSummary } from '@/entities/auth';

import { entitlementNextStep } from './entitlement-next-step';

const signedIn = (role: UserSummary['role']): AuthState => ({
  status: 'authenticated',
  token: 't',
  user: { role } as UserSummary,
});

test('이용권이 없어 막히면 로그인 전에는 로그인, 보호자는 내 이용권, 원장은 기관 이용권으로 안내한다', () => {
  assert.deepEqual(entitlementNextStep({ status: 'anonymous' }, '/play/X?resume=1'), {
    label: '로그인하기',
    path: '/login?next=%2Fplay%2FX%3Fresume%3D1',
  });
  assert.equal(entitlementNextStep(signedIn('PARENT'), '/play/X')?.path, '/mypage/subscription');
  assert.equal(entitlementNextStep(signedIn('DIRECTOR'), '/play/X')?.path, '/organization/subscription');
});

test('선생님·직원은 직접 결제하지 않으므로 버튼을 두지 않는다', () => {
  assert.equal(entitlementNextStep(signedIn('TUTOR'), '/play/X'), null);
  assert.equal(entitlementNextStep(signedIn('STAFF'), '/play/X'), null);
  assert.equal(entitlementNextStep({ status: 'loading' }, '/play/X'), null);
});
