/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { playerChildSync } from './player-child-sync';

const base = { requestedChildId: 'b', isParent: true, childrenLoading: false, childIds: ['a', 'b'], selectedChildId: 'a' };

test('요청한 아이가 전역 선택과 다르면 먼저 선택을 맞춘다', () => {
  assert.deepEqual(playerChildSync(base), { kind: 'select', childId: 'b' });
});

test('선택이 맞으면 바로 재생 화면', () => {
  assert.deepEqual(playerChildSync({ ...base, selectedChildId: 'b' }), { kind: 'ready' });
});

test('아이 목록을 불러오는 중엔 기다린다 - 플레이어가 다른 아이 이름으로 먼저 뜨지 않게', () => {
  assert.deepEqual(playerChildSync({ ...base, childrenLoading: true }), { kind: 'wait' });
});

test('요청이 없거나 보호자가 아니거나 모르는 아이면 지금 선택 그대로', () => {
  assert.deepEqual(playerChildSync({ ...base, requestedChildId: null }), { kind: 'ready' });
  assert.deepEqual(playerChildSync({ ...base, isParent: false }), { kind: 'ready' });
  assert.deepEqual(playerChildSync({ ...base, requestedChildId: 'gone' }), { kind: 'ready' });
});
