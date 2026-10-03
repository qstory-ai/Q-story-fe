/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { legacyRedirectPath, ORGANIZATION_PATHS, TUTOR_PATHS } from './app-paths';

test('예전 선생님 경로는 새 반·학생 경로로 옮긴다', () => {
  assert.equal(legacyRedirectPath('/tutor/students'), '/tutor/classes');
  assert.equal(legacyRedirectPath('/tutor/students/'), '/tutor/classes');
  assert.equal(legacyRedirectPath('/tutor/class-groups'), '/tutor/classes');
  assert.equal(legacyRedirectPath('/tutor/class-groups/new'), '/tutor/classes/new');
  assert.equal(legacyRedirectPath('/tutor/class-groups/abc-123'), '/tutor/classes/abc-123');
});

test('예전 이용 현황은 합친 리포트 화면으로 옮긴다', () => {
  assert.equal(legacyRedirectPath('/organization/usage'), '/organization/reports');
});

test('지금 쓰는 경로는 옮기지 않는다', () => {
  for (const path of ['/tutor/classes', '/tutor/classes/new', '/tutor/lessons', '/tutor/lessons/l1', '/tutor/students/s1',
    '/organization/reports', '/organization/classes/c1', '/tutor/class-groups/a/b']) {
    assert.equal(legacyRedirectPath(path), null, path);
  }
});

test('경로 상수', () => {
  assert.equal(TUTOR_PATHS.classDetail('c1'), '/tutor/classes/c1');
  assert.equal(TUTOR_PATHS.lesson('l1'), '/tutor/lessons/l1');
  assert.equal(ORGANIZATION_PATHS.student('c1', 's1'), '/organization/classes/c1/students/s1');
});
