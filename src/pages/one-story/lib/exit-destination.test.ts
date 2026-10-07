// @ts-nocheck -- Node 테스트 러너 타입은 Expo 번들에서 의도적으로 제외한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveExit } from './exit-destination';

const parent = { status: 'authenticated', token: 't', user: { role: 'PARENT' } };
const tutor = { status: 'authenticated', token: 't', user: { role: 'TUTOR' } };
const anonymous = { status: 'anonymous' };

test('이야기 도중 나가기는 진행을 저장하고 역할 홈으로 간다', () => {
  assert.deepEqual(resolveExit(parent, 'playing-fixed'), { path: '/parent', saveProgress: true, clearProgress: false });
  assert.deepEqual(resolveExit(tutor, 'awaiting-choice'), { path: '/tutor', saveProgress: true, clearProgress: false });
});

test('비로그인은 /로, 진행은 저장해 이어 듣기가 된다', () => {
  assert.deepEqual(resolveExit(anonymous, 'playing-fixed'), { path: '/', saveProgress: true, clearProgress: false });
  assert.deepEqual(resolveExit({ status: 'loading' }, 'playing-fixed').path, '/');
});

test('완주 후 나가기: 로그인은 기록을 정리하고, 익명 데모는 남겨 둔다', () => {
  assert.deepEqual(resolveExit(parent, 'complete'), { path: '/parent', saveProgress: false, clearProgress: true });
  assert.deepEqual(resolveExit(anonymous, 'complete'), { path: '/', saveProgress: false, clearProgress: false });
});
