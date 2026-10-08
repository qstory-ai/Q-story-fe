/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { LocalStoryProgress } from '@/entities/analytics';
import type { AuthState, UserSummary } from '@/entities/auth';
import type { Child } from '@/entities/child';
import type { StoryCatalogEntry } from '@/entities/story';

import { resumeStart, startFromLibraryCard, startStoryFromHome, storyPlayPath } from './play-path';

const story = (storyId: string, requiresEntitlement = false) =>
  ({ storyId, requiresEntitlement } as StoryCatalogEntry);
const parent: AuthState = { status: 'authenticated', token: 't', user: { role: 'PARENT', grantsAccess: false } as UserSummary };
const child = (id: string, name: string) => ({ id, name } as Child);
const A = child('child-a', '하윤');
const B = child('child-b', '민준');
const progress = (over: Partial<LocalStoryProgress> = {}) =>
  ({ storyId: 'HG', childName: '민준', ...over } as LocalStoryProgress);

test('플레이어 경로는 아이와 이어듣기 여부를 쿼리로 싣는다', () => {
  assert.equal(storyPlayPath('HG'), '/stories/HG/play');
  assert.equal(storyPlayPath('HG', { childId: 'child-a' }), '/stories/HG/play?childId=child-a');
  assert.equal(storyPlayPath('HG', { childId: 'child-a', resume: true }), '/stories/HG/play?childId=child-a&resume=1');
  assert.equal(storyPlayPath('a b'), '/stories/a%20b/play');
  assert.equal(storyPlayPath('HG', { childId: 'child-a', from: 'report' }), '/stories/HG/play?childId=child-a&from=report');
});

test('홈 히어로는 상세를 거치지 않고 선택된 아이로 바로 재생한다', () => {
  assert.deepEqual(
    startStoryFromHome({ story: story('HG'), auth: parent, children: [A, B], selectedChildId: 'child-b' }),
    { kind: 'navigate', path: '/stories/HG/play?childId=child-b&from=home' },
  );
});

test('아이가 없으면 아이 등록부터', () => {
  assert.deepEqual(
    startStoryFromHome({ story: story('HG'), auth: parent, children: [], selectedChildId: null }),
    { kind: 'pick-child' },
  );
});

test('잠긴 이야기는 기존 목적지(이용권)로', () => {
  assert.deepEqual(
    startStoryFromHome({ story: story('P1', true), auth: parent, children: [A], selectedChildId: 'child-a' }),
    { kind: 'navigate', path: '/mypage/subscription' },
  );
});

// 재현: 예전 "이어서 읽기"는 /stories/HG/play 로만 이동해, 플레이어가 지금 선택된 아이(A)로 완주를
// 기록했다 - 진행을 남긴 아이(B)가 아니라. 이어서 읽기는 진행을 남긴 아이를 골라 경로에 실어야 한다.
test('이어서 읽기는 지금 선택된 아이가 아니라 진행을 남긴 아이로 재생한다', () => {
  assert.deepEqual(
    resumeStart({ progress: progress({ childId: 'child-b' }), children: [A, B] }),
    { kind: 'navigate', path: '/stories/HG/play?childId=child-b&resume=1' },
  );
});

test('아이 id가 없는 이전 기록은 저장된 이름이 한 아이와만 맞을 때 그 아이로', () => {
  assert.deepEqual(
    resumeStart({ progress: progress({ childName: ' 민준 ' }), children: [A, B] }),
    { kind: 'navigate', path: '/stories/HG/play?childId=child-b&resume=1' },
  );
});

test('누구의 기록인지 모르면 다른 아이로 저장하지 않도록 아이를 고르게 한다', () => {
  assert.deepEqual(resumeStart({ progress: progress({ childName: '' }), children: [A, B] }), { kind: 'pick-child' });
  assert.deepEqual(
    resumeStart({ progress: progress({ childName: '하윤' }), children: [A, child('child-c', '하윤')] }),
    { kind: 'pick-child' },
  );
  // 삭제된 아이의 기록
  assert.deepEqual(resumeStart({ progress: progress({ childId: 'gone', childName: '' }), children: [A, B] }), { kind: 'pick-child' });
});

test('아이가 한 명이면 그 아이로, 없으면 아이 없이 이어서', () => {
  assert.deepEqual(
    resumeStart({ progress: progress({ childName: '' }), children: [A] }),
    { kind: 'navigate', path: '/stories/HG/play?childId=child-a&resume=1' },
  );
  assert.deepEqual(
    resumeStart({ progress: progress(), children: [] }),
    { kind: 'navigate', path: '/stories/HG/play?resume=1' },
  );
});

test('홈 히어로: 같은 이야기 진행이 있으면 처음부터가 아니라 바로 이어 읽는다', () => {
  assert.deepEqual(
    startStoryFromHome({ story: story('HG'), auth: parent, children: [A, B], selectedChildId: 'child-b', progress: progress({ childId: 'child-b' }) }),
    { kind: 'navigate', path: '/stories/HG/play?childId=child-b&resume=1' },
  );
});

test('홈 히어로: 다른 이야기의 진행은 영향이 없다', () => {
  assert.deepEqual(
    startStoryFromHome({ story: story('P2'), auth: parent, children: [A, B], selectedChildId: 'child-b', progress: progress({ childId: 'child-b' }) }),
    { kind: 'navigate', path: '/stories/P2/play?childId=child-b&from=home' },
  );
});

test('서재 읽는 중 카드는 상세 없이 바로 이어 읽는다', () => {
  assert.deepEqual(
    startFromLibraryCard({ story: story('HG'), auth: parent, children: [A, B], progress: progress({ childId: 'child-a' }) }),
    { kind: 'navigate', path: '/stories/HG/play?childId=child-a&resume=1' },
  );
});

test('서재: 진행이 없는 카드·잠긴 이야기는 평소 목적지로', () => {
  assert.deepEqual(
    startFromLibraryCard({ story: story('P2'), auth: parent, children: [A], progress: progress() }),
    { kind: 'navigate', path: '/stories/P2' },
  );
  assert.deepEqual(
    startFromLibraryCard({ story: story('P1', true), auth: parent, children: [A], progress: progress({ storyId: 'P1', childId: 'child-a' }) }),
    { kind: 'navigate', path: '/mypage/subscription' },
  );
});
