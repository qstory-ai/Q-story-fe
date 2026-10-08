/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decideDemoSync } from './sync-guard';

test('childId가 없는 기록은 진짜 익명 데모라 옮긴다', () => {
  assert.equal(decideDemoSync({}, []), 'sync');
  assert.equal(decideDemoSync({ childId: null }, ['a']), 'sync');
});

test('내 아이의 기록이면 옮긴다', () => {
  assert.equal(decideDemoSync({ childId: 'a' }, ['a', 'b']), 'sync');
});

test('다른 계정의 아이이거나 아이가 없는 계정이면 버린다', () => {
  assert.equal(decideDemoSync({ childId: 'x' }, ['a']), 'discard');
  assert.equal(decideDemoSync({ childId: 'x' }, []), 'discard');
});
