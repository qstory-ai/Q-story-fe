import assert from 'node:assert/strict';
import { test } from 'node:test';

import { classInviteLink, homeroomInviteLink, homeroomInviteShareMessage } from './invite-links';

// node에는 window가 없어 webOrigin()이 빈 문자열 - 브라우저처럼 출처를 하나 둔다.
(globalThis as { window?: unknown }).window = { location: { origin: 'https://qstory.test' } };

test('담임 초대 링크는 /homeroom-invite?code=', () => {
  assert.equal(homeroomInviteLink('AB12CD34'), 'https://qstory.test/homeroom-invite?code=AB12CD34');
  assert.equal(classInviteLink('AB12CD34'), 'https://qstory.test/join?code=AB12CD34');
});

test('담임 초대 공유 문구 - 기관 이름이 있으면 앞에 붙인다', () => {
  assert.equal(
    homeroomInviteShareMessage('햇살반', 'OO유치원'),
    'OO유치원 햇살반 담임 선생님 초대예요. 아래 링크로 가입하면 바로 햇살반 담임으로 연결돼요.',
  );
  assert.equal(
    homeroomInviteShareMessage('햇살반', null),
    '햇살반 담임 선생님 초대예요. 아래 링크로 가입하면 바로 햇살반 담임으로 연결돼요.',
  );
});
