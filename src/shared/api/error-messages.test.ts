/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { messageForError } from './error-messages';

const INVITE_COPY = '초대 링크가 만료됐거나 이미 사용됐어요. 발급한 분께 다시 요청해 주세요.';

test('410은 서버가 준 이유 문장을 그대로 보여 준다 - 지난 반 코드 안내', () => {
  const detail = '지난 반이라 더 이상 들어갈 수 없어요. 새 반 코드를 받아 주세요.';
  assert.equal(messageForError({ status: 410, code: 'INVALID_INVITE', message: detail }), detail);
});

test('410이라도 이유 문장이 없으면 공통 초대 문구', () => {
  assert.equal(messageForError({ status: 410, code: 'INVALID_INVITE', message: '' }), INVITE_COPY);
});

test('410이 아니면 코드 사전이 먼저다', () => {
  assert.equal(messageForError({ status: 400, code: 'INVALID_INVITE', message: 'raw' }), INVITE_COPY);
});
