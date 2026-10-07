/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parsePlaySetting, playEntrySource, sessionShortCode } from './types';

test('UT 회차 코드는 회차 id 앞 6자를 대문자로', () => {
  assert.equal(sessionShortCode('95dcd3a1-0b2c-4d5e-8f90-123456789abc'), '95DCD3');
  assert.equal(sessionShortCode('95dc-d3a1-0000'), '95DCD3');
  assert.equal(sessionShortCode(null), null);
  assert.equal(sessionShortCode(''), null);
  assert.equal(sessionShortCode('demo'), null);
});

test('진행 형태는 아는 값만 받는다', () => {
  assert.equal(parsePlaySetting('SMALL_GROUP'), 'SMALL_GROUP');
  assert.equal(parsePlaySetting('HOME'), 'HOME');
  assert.equal(parsePlaySetting('small_group'), null);
  assert.equal(parsePlaySetting(null), null);
});

test('회차를 시작한 곳 - from= → 수업 → 이어서 읽기 → 상세 순', () => {
  assert.equal(playEntrySource({ demo: true, from: 'report' }), 'demo');
  assert.equal(playEntrySource({ from: 'report', entry: 'resume' }), 'report_reread');
  assert.equal(playEntrySource({ from: 'library' }), 'library');
  assert.equal(playEntrySource({ lessonId: 'lesson-1' }), 'lesson');
  assert.equal(playEntrySource({ entry: 'resume' }), 'resume');
  assert.equal(playEntrySource({ from: 'home', entry: 'start' }), 'home_hero');
  // 상세 화면도 아이를 실어 열기 때문에 childId(start)만으로는 홈 히어로로 보지 않는다.
  assert.equal(playEntrySource({ entry: 'start' }), 'detail');
  assert.equal(playEntrySource({}), 'detail');
});
