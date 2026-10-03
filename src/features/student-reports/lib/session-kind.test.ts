/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { sessionKindLabel } from './session-kind';

test('기록 구분 라벨', () => {
  assert.equal(sessionKindLabel('CLASS'), '반 수업');
  assert.equal(sessionKindLabel('TUTOR'), '개별 수업');
  assert.equal(sessionKindLabel('HOME'), '집에서 읽음');
});
