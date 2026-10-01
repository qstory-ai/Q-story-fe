/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { AuthState, UserSummary } from '@/entities/auth';
import type { StoryCatalogEntry } from '@/entities/story';

import { storyDestination } from './story-destination';

const story = (storyId: string, requiresEntitlement: boolean) =>
  ({ storyId, requiresEntitlement } as StoryCatalogEntry);
const authed = (role: UserSummary['role'], grantsAccess: boolean): AuthState =>
  ({ status: 'authenticated', token: 't', user: { role, grantsAccess } as UserSummary });

test('로그인 상태면 체험 이야기도 상세로', () => {
  assert.equal(storyDestination(story('HG', false), authed('PARENT', false)), '/stories/HG');
});

test('비로그인 체험 이야기는 데모로, 무료 이야기는 상세로', () => {
  assert.equal(storyDestination(story('HG', false), { status: 'anonymous' }), '/demo');
  assert.equal(storyDestination(story('FREE', false), { status: 'anonymous' }), '/stories/FREE');
});

test('비로그인 잠긴 이야기는 로그인 후 상세로 돌아온다', () => {
  assert.equal(storyDestination(story('P1', true), { status: 'anonymous' }), '/login?next=%2Fstories%2FP1');
});

test('로그인했지만 잠긴 이야기는 이용권 페이지로', () => {
  assert.equal(storyDestination(story('P1', true), authed('PARENT', false)), '/mypage/subscription');
  assert.equal(storyDestination(story('P1', true), authed('TUTOR', false)), '/mypage/subscription');
});

test('열린 유료 이야기는 상세로', () => {
  assert.equal(storyDestination(story('P1', true), authed('TUTOR', true)), '/stories/P1');
});
