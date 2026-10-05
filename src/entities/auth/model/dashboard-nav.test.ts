/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { UserSummary } from '../api/auth-api';
import { dashboardNavItems, navKeyForPath } from './dashboard-nav';

test('관리자 하위 화면은 자기 탭을 강조한다', () => {
  assert.equal(navKeyForPath('DIRECTOR', '/organization'), 'home');
  assert.equal(navKeyForPath('DIRECTOR', '/stories/HG'), 'home');
  assert.equal(navKeyForPath('DIRECTOR', '/organization/classes'), 'classes');
  assert.equal(navKeyForPath('DIRECTOR', '/organization/classes/abc'), 'classes');
  assert.equal(navKeyForPath('DIRECTOR', '/organization/tutors/t1'), 'tutors');
  assert.equal(navKeyForPath('DIRECTOR', '/organization/classes/abc/students/s1'), 'classes');
  assert.equal(navKeyForPath('DIRECTOR', '/organization/usage'), 'reports');
  assert.equal(navKeyForPath('DIRECTOR', '/organization/reports'), 'reports');
  assert.equal(navKeyForPath('DIRECTOR', '/reports/c1'), 'reports');
  assert.equal(navKeyForPath('DIRECTOR', '/organization/subscription'), 'mypage');
});

test('선생님: 반·학생 화면은 반·학생 탭, 수업 화면은 수업 탭을 강조한다', () => {
  assert.equal(navKeyForPath('TUTOR', '/tutor'), 'home');
  assert.equal(navKeyForPath('TUTOR', '/tutor/library'), 'library');
  assert.equal(navKeyForPath('TUTOR', '/tutor/classes'), 'classes');
  assert.equal(navKeyForPath('TUTOR', '/tutor/classes/new'), 'classes');
  assert.equal(navKeyForPath('TUTOR', '/tutor/classes/c1'), 'classes');
  assert.equal(navKeyForPath('TUTOR', '/tutor/students/s1'), 'classes');
  assert.equal(navKeyForPath('TUTOR', '/tutor/class-groups/new'), 'classes');
  assert.equal(navKeyForPath('TUTOR', '/tutor/lessons'), 'lessons');
  assert.equal(navKeyForPath('TUTOR', '/tutor/lessons/l1'), 'lessons');
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

function tabsFor(role: UserSummary['role'], pathname: string) {
  const visited: string[] = [];
  const user = { id: 'u1', role, displayName: '테스트' } as UserSummary;
  const items = dashboardNavItems(user, (path) => visited.push(path), pathname);
  items.forEach((item) => item.onPress());
  return { items, visited };
}

test('선생님 탭: 반·학생과 수업이 각자 자기 목록으로 간다', () => {
  const { items, visited } = tabsFor('TUTOR', '/tutor/students/s1');
  assert.deepEqual(items.map((item) => item.label), ['홈', '반·학생', '수업', '서재', '리포트', '마이페이지']);
  assert.deepEqual(visited.slice(1, 3), ['/tutor/classes', '/tutor/lessons']);
  // 학생 상세에서 강조된 탭을 누르면 반·학생 목록으로 간다(예전엔 "수업" 강조인데 수업 목록으로 갔다).
  const activeIndex = items.findIndex((item) => item.active);
  assert.equal(visited[activeIndex], '/tutor/classes');
});

test('관리자 탭: 이용 현황은 리포트 탭으로 합쳤다', () => {
  const { items, visited } = tabsFor('DIRECTOR', '/organization/usage');
  assert.deepEqual(items.map((item) => item.label), ['홈', '반·학생', '선생님', '리포트', '마이페이지']);
  const activeIndex = items.findIndex((item) => item.active);
  assert.equal(visited[activeIndex], '/organization/reports');
});
