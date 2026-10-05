/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LEGACY_REDIRECTS } from './legacy-redirects';

test('합쳐진 마이페이지 화면의 옛 경로는 새 화면으로 간다', () => {
  const map = new Map(LEGACY_REDIRECTS);
  assert.equal(map.get('/mypage/profile'), '/mypage/account');
  assert.equal(map.get('/mypage/notifications'), '/mypage/settings');
  assert.equal(map.get('/mypage/privacy'), '/mypage/settings');
  for (const [from, to] of LEGACY_REDIRECTS) assert.notEqual(from, to);
});
