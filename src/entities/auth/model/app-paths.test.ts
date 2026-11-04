/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ORGANIZATION_PATHS, TUTOR_PATHS } from './app-paths';

test('경로 상수', () => {
  assert.equal(TUTOR_PATHS.classDetail('c1'), '/tutor/classes/c1');
  assert.equal(TUTOR_PATHS.lesson('l1'), '/tutor/lessons/l1');
  assert.equal(ORGANIZATION_PATHS.student('c1', 's1'), '/organization/classes/c1/students/s1');
});
