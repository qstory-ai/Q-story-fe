import assert from 'node:assert/strict';
import test from 'node:test';

import { inviteAskCopy, inviteAskKind } from './invite-ask-kind';

test('방법을 묻는 초대는 "내 생각 말하기"로, 궁금증을 묻는 초대는 "궁금한 거 물어보기"로', () => {
  assert.equal(inviteAskKind('마녀에게 들키지 않고 열쇠를 가져오려면 어떻게 하면 좋을까?'), 'idea');
  assert.equal(inviteAskKind('저 새를 보니 궁금한 게 있어?'), 'curiosity');
  assert.equal(inviteAskKind('우린 이 집에 처음 왔어. 들어가기 전에 알아보고 싶은 게 있어?'), 'curiosity');
  assert.equal(inviteAskCopy('idea').askLabel, '내 생각 말하기');
  assert.equal(inviteAskCopy('curiosity').askLabel, '궁금한 거 물어보기');
});
