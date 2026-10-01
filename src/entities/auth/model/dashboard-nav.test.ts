/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { navKeyForPath } from './dashboard-nav';

test('관리자 하위 화면은 자기 탭을 강조한다', () => {
  assert.equal(navKeyForPath('DIRECTOR', '/organization'), 'home');
  assert.equal(navKeyForPath('DIRECTOR', '/stories/HG'), 'home');
  assert.equal(navKeyForPath('DIRECTOR', '/organization/classes'), 'classes');
  assert.equal(navKeyForPath('DIRECTOR', '/organization/classes/abc'), 'classes');
  assert.equal(navKeyForPath('DIRECTOR', '/organization/tutors/t1'), 'tutors');
  assert.equal(navKeyForPath('DIRECTOR', '/organization/usage'), 'usage');
  assert.equal(navKeyForPath('DIRECTOR', '/organization/reports'), 'reports');
  assert.equal(navKeyForPath('DIRECTOR', '/organization/subscription'), 'mypage');
});

test('선생님 경로 매핑은 현재 동작을 유지한다', () => {
  assert.equal(navKeyForPath('TUTOR', '/tutor'), 'home');
  assert.equal(navKeyForPath('TUTOR', '/tutor/library'), 'library');
  assert.equal(navKeyForPath('TUTOR', '/tutor/students/s1'), 'classes');
  assert.equal(navKeyForPath('TUTOR', '/tutor/class-groups/new'), 'classes');
  assert.equal(navKeyForPath('TUTOR', '/tutor/lessons/l1'), 'classes');
  assert.equal(navKeyForPath('TUTOR', '/reports/c1'), 'reports');
  assert.equal(navKeyForPath('TUTOR', '/tutor/join-organization'), 'mypage');
  assert.equal(navKeyForPath('TUTOR', '/stories/HG'), 'library');
});

test('보호자 경로 매핑', () => {
  assert.equal(navKeyForPath('PARENT', '/parent'), 'home');
  assert.equal(navKeyForPath('PARENT', '/stories/HG'), 'library');
  assert.equal(navKeyForPath('PARENT', '/reports/c1'), 'reports');
  assert.equal(navKeyForPath('PARENT', '/payment/checkout'), 'mypage');
});

test('접두사가 단어 경계에서만 맞는다', () => {
  assert.equal(navKeyForPath('PARENT', '/parentx'), null);
});
