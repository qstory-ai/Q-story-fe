/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { afterSignUpPath } from './after-sign-up';

test('초대받아 가입한 선생님은 소속 설정 대신 초대 수락 화면으로', () => {
  assert.equal(afterSignUpPath('TUTOR', '/org-invite/abc'), '/org-invite/abc');
});

test('초대 없이 가입하면 역할별 온보딩으로', () => {
  assert.equal(afterSignUpPath('TUTOR', undefined), '/onboarding/tutor');
  assert.equal(afterSignUpPath('PARENT', undefined), '/onboarding/parent');
  assert.equal(afterSignUpPath('DIRECTOR', undefined), '/organization');
});

test('보호자의 next는 아이 등록 뒤에 쓰므로 온보딩부터', () => {
  assert.equal(afterSignUpPath('PARENT', '/join?code=AB12'), '/onboarding/parent');
});
