/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { backTarget } from './back-target';

test('앱 안에서 이동해 왔으면 직전 화면으로', () => {
  assert.equal(backTarget('k3j2', '/reports'), -1);
});

test('링크로 바로 들어왔으면(첫 항목) 대체 경로로', () => {
  assert.equal(backTarget('default', '/reports'), '/reports');
});
