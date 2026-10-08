import assert from 'node:assert/strict';
import { test } from 'node:test';

import { internalHrefOrNull, permissionStep, shouldSendToken } from './push-logic';

test('푸시 href는 앱 안 경로만 받는다', () => {
  assert.equal(internalHrefOrNull('/reports/abc'), '/reports/abc');
  assert.equal(internalHrefOrNull('/reports/abc?x=1#top'), '/reports/abc?x=1#top');
  assert.equal(internalHrefOrNull('/'), '/');
  assert.equal(internalHrefOrNull('https://example.com/a'), null);
  assert.equal(internalHrefOrNull('//example.com/a'), null);
  assert.equal(internalHrefOrNull('/\\example.com'), null);
  assert.equal(internalHrefOrNull('javascript:alert(1)'), null);
  assert.equal(internalHrefOrNull('reports/abc'), null);
  assert.equal(internalHrefOrNull('/a b'), null);
  assert.equal(internalHrefOrNull('/a\nb'), null);
  assert.equal(internalHrefOrNull(''), null);
  assert.equal(internalHrefOrNull(undefined), null);
  assert.equal(internalHrefOrNull(42), null);
});

test('토큰은 처음이거나 토큰·계정이 바뀌었을 때만 보낸다', () => {
  assert.equal(shouldSendToken('t1', 'u1', null), true);
  assert.equal(shouldSendToken('t1', 'u1', { token: 't1', userId: 'u1' }), false);
  assert.equal(shouldSendToken('t2', 'u1', { token: 't1', userId: 'u1' }), true);
  assert.equal(shouldSendToken('t1', 'u2', { token: 't1', userId: 'u1' }), true);
  assert.equal(shouldSendToken(null, 'u1', null), false);
  assert.equal(shouldSendToken('t1', null, null), false);
});

test('알림 권한은 한 번만 묻는다', () => {
  assert.equal(permissionStep('granted', false), 'register');
  assert.equal(permissionStep('granted', true), 'register');
  assert.equal(permissionStep('prompt', false), 'request');
  assert.equal(permissionStep('prompt-with-rationale', false), 'request');
  assert.equal(permissionStep('prompt', true), 'skip');
  assert.equal(permissionStep('denied', false), 'skip');
});
