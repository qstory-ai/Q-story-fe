import assert from 'node:assert/strict';
import { test } from 'node:test';

import { safeNextPath } from '@/pages/home/model/onboarding-params';

import {
  selectHomeroomInviteView,
  shouldAutoAccept,
  tutorSignInPath,
  tutorSignUpPath,
  type PreviewLoad,
} from './homeroom-invite-view';

const READY: PreviewLoad<{ className: string }> = { status: 'ready', preview: { className: '햇살반' } };
const TUTOR = { status: 'authenticated', role: 'TUTOR' } as const;

test('코드가 없으면 잘못된 초대', () => {
  assert.equal(selectHomeroomInviteView('', READY, TUTOR), 'invalid');
});

test('불러오는 중에는 로딩 - 미리보기와 로그인 상태 둘 다 기다린다', () => {
  assert.equal(selectHomeroomInviteView('AB12', { status: 'loading' }, TUTOR), 'loading');
  assert.equal(selectHomeroomInviteView('AB12', READY, { status: 'loading' }), 'loading');
});

test('미리보기 실패 - 만료·사용, 없는 코드, 그 밖', () => {
  assert.equal(selectHomeroomInviteView('AB12', { status: 'error', kind: 'expired', message: '' }, TUTOR), 'expired');
  assert.equal(selectHomeroomInviteView('AB12', { status: 'error', kind: 'not-found', message: '' }, TUTOR), 'invalid');
  assert.equal(selectHomeroomInviteView('AB12', { status: 'error', kind: 'other', message: '' }, TUTOR), 'error');
});

test('로그인 전·선생님·다른 역할', () => {
  assert.equal(selectHomeroomInviteView('AB12', READY, { status: 'anonymous' }), 'sign-in');
  assert.equal(selectHomeroomInviteView('AB12', READY, TUTOR), 'accept');
  assert.equal(selectHomeroomInviteView('AB12', READY, { status: 'authenticated', role: 'PARENT' }), 'wrong-role');
  assert.equal(selectHomeroomInviteView('AB12', READY, { status: 'authenticated', role: 'DIRECTOR' }), 'wrong-role');
});

test('수락하다 만료로 판명되면 만료 안내', () => {
  assert.equal(selectHomeroomInviteView('AB12', READY, TUTOR, 'expired'), 'expired');
  assert.equal(selectHomeroomInviteView('AB12', READY, TUTOR, 'other'), 'accept');
});

test('자동 수락은 accept=1로 돌아온 선생님에게 한 번만', () => {
  assert.equal(shouldAutoAccept('accept', true, false), true);
  assert.equal(shouldAutoAccept('accept', true, true), false);
  assert.equal(shouldAutoAccept('accept', false, false), false);
  assert.equal(shouldAutoAccept('wrong-role', true, false), false);
});

test('가입·로그인은 이 초대로 돌아와 자동 수락한다(홈의 next 검증을 통과한다)', () => {
  const signUp = new URLSearchParams(tutorSignUpPath('AB12CD34').slice(2));
  assert.equal(signUp.get('flow'), 'sign-up');
  assert.equal(signUp.get('role'), 'tutor');
  assert.equal(signUp.get('next'), '/homeroom-invite?code=AB12CD34&accept=1');
  assert.equal(safeNextPath(signUp.get('next')), '/homeroom-invite?code=AB12CD34&accept=1');
  const signIn = new URLSearchParams(tutorSignInPath('AB12CD34').slice(2));
  assert.equal(signIn.get('flow'), 'sign-in');
  assert.equal(signIn.get('next'), '/homeroom-invite?code=AB12CD34&accept=1');
});
