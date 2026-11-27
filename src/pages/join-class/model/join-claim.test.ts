/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { clearJoinClaim, normalizeClaim, resolveJoinClaim } from './join-claim';

function memory() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

test('연결 코드는 대문자로, 이상한 값은 버린다', () => {
  assert.equal(normalizeClaim(' k7qx2m '), 'K7QX2M');
  assert.equal(normalizeClaim('a b'), null);
  assert.equal(normalizeClaim(null), null);
});

test('가입하고 claim 없이 돌아와도 같은 반이면 저장한 코드를 쓴다', () => {
  const store = memory();
  assert.equal(resolveJoinClaim('CLASS1', 'k7qx2m', store), 'K7QX2M');
  assert.equal(resolveJoinClaim('CLASS1', null, store), 'K7QX2M');
  assert.equal(resolveJoinClaim('OTHER', null, store), null);
  clearJoinClaim(store);
  assert.equal(resolveJoinClaim('CLASS1', null, store), null);
});
