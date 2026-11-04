// @ts-nocheck -- Node 테스트 러너 타입은 Expo 번들에서 의도적으로 제외한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { LEGACY_REDIRECTS, LEGACY_ROUTE_PATHS, legacyRedirectPath } from './legacy-redirects';

test('옛 경로는 지금 경로로 간다(끝 슬래시 무시, id는 그대로)', () => {
  assert.equal(legacyRedirectPath('/tutor/students'), '/tutor/classes');
  assert.equal(legacyRedirectPath('/tutor/students/'), '/tutor/classes');
  assert.equal(legacyRedirectPath('/tutor/class-groups'), '/tutor/classes');
  assert.equal(legacyRedirectPath('/tutor/class-groups/new'), '/tutor/classes/new');
  assert.equal(legacyRedirectPath('/tutor/class-groups/abc-123'), '/tutor/classes/abc-123');
  assert.equal(legacyRedirectPath('/organization/usage'), '/organization/reports');
  assert.equal(legacyRedirectPath('/mypage/profile'), '/mypage/account');
});

test('지금 경로는 옮기지 않는다', () => {
  for (const path of ['/tutor/classes', '/tutor/classes/new', '/tutor/classes/abc', '/tutor/students/abc', '/organization/reports', '/']) {
    assert.equal(legacyRedirectPath(path), null, path);
  }
});

test('표는 자기 자신으로 보내지 않고, 옮긴 곳이 다시 옛 경로가 아니다', () => {
  const map = new Map(LEGACY_REDIRECTS);
  for (const [from, to] of LEGACY_REDIRECTS) {
    assert.notEqual(from, to);
    assert.equal(map.has(to), false, `${from} → ${to}`);
  }
  assert.ok(LEGACY_ROUTE_PATHS.length >= LEGACY_REDIRECTS.length);
});
