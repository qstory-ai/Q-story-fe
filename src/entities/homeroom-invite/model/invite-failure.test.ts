import assert from 'node:assert/strict';
import { test } from 'node:test';

import { homeroomInviteFailureKind, homeroomInviteFailureMessage, homeroomInvitePath, tutorInviteCodeDestination } from './invite-failure';

test('410·INVALID_INVITE는 만료, 404는 없는 코드, 나머지는 다시 시도', () => {
  assert.equal(homeroomInviteFailureKind({ status: 410 }), 'expired');
  assert.equal(homeroomInviteFailureKind({ status: 400, code: 'INVALID_INVITE' }), 'expired');
  assert.equal(homeroomInviteFailureKind({ status: 404 }), 'not-found');
  assert.equal(homeroomInviteFailureKind({ status: 500 }), 'other');
  assert.equal(homeroomInviteFailureKind(new Error('network')), 'other');
  assert.equal(homeroomInviteFailureKind(undefined), 'other');
});

test('410은 서버가 나눠 준 이유 문장을 그대로, 없으면 공통 문구', () => {
  assert.equal(
    homeroomInviteFailureMessage({ status: 410, code: 'INVALID_INVITE', message: '기한이 지났어요.' }, 'x'),
    '기한이 지났어요.',
  );
  assert.equal(
    homeroomInviteFailureMessage({ status: 410, code: 'INVALID_INVITE', message: '' }, 'x'),
    '초대 링크가 만료됐거나 이미 사용됐어요. 발급한 분께 다시 요청해 주세요.',
  );
});

test('담임 초대 화면 주소 - 자동 수락 표시는 가입·로그인 뒤 돌아올 때만', () => {
  assert.equal(homeroomInvitePath('AB12CD34'), '/homeroom-invite?code=AB12CD34');
  assert.equal(homeroomInvitePath('AB12CD34', true), '/homeroom-invite?code=AB12CD34&accept=1');
});

test('입력한 코드가 담임 초대면 담임 초대 화면, 없는 코드면 기관 초대 화면', async () => {
  assert.equal(await tutorInviteCodeDestination('HOME1234', async () => ({})), '/homeroom-invite?code=HOME1234');
  assert.equal(
    await tutorInviteCodeDestination('ORG12345', async () => { throw { status: 404 }; }),
    '/org-invite/code/ORG12345',
  );
  assert.equal(
    await tutorInviteCodeDestination('OLD12345', async () => { throw { status: 410 }; }),
    '/homeroom-invite?code=OLD12345',
  );
  // 네트워크 오류 등은 기관 초대 화면이 자기 오류를 보여 준다.
  assert.equal(
    await tutorInviteCodeDestination('ANY12345', async () => { throw new Error('offline'); }),
    '/org-invite/code/ANY12345',
  );
});
