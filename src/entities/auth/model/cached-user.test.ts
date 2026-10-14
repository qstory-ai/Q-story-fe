import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { UserSummary } from '../api/auth-api';
import { createUserCache } from './cached-user';

const KEY = 'qstory.auth.user.v1';

function base64url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function jwt(claims: Record<string, unknown>): string {
  return `${base64url(JSON.stringify({ alg: 'HS256' }))}.${base64url(JSON.stringify(claims))}.sig`;
}

class MemoryStorage {
  readonly items = new Map<string, string>();
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
}

function caches() {
  const local = new MemoryStorage();
  const session = new MemoryStorage();
  return { local, session, cache: createUserCache({ local: () => local, session: () => session }) };
}

const USER: UserSummary = {
  id: 'u1',
  role: 'PARENT',
  loginId: 'parent01',
  email: 'parent@example.com',
  displayName: '김보호',
  organizationId: null,
  subscriptionStatus: 'ACTIVE',
  grantsAccess: true,
  childName: '김하늘',
  profileImageUrl: 'https://example.com/p.png',
  subscriptionExpiresAt: '2026-12-01T00:00:00Z',
  pendingConsents: ['GUARDIAN'],
};

const remembered = jwt({ sub: 'u1', role: 'PARENT', rm: true });
const sessionOnly = jwt({ sub: 'u1', role: 'PARENT', rm: false });

test('화면 분기에 필요한 값과 이름만 저장한다 - 연락처·로그인 아이디·아이 이름·사진은 남기지 않는다', () => {
  const { local, cache } = caches();
  cache.write(remembered, USER);
  const raw = local.getItem(KEY);
  assert.ok(raw);
  const stored = JSON.parse(raw) as Record<string, unknown>;
  assert.deepEqual(Object.keys(stored).sort(), [
    'displayName',
    'grantsAccess',
    'id',
    'organizationId',
    'pendingConsents',
    'role',
    'subscriptionStatus',
  ]);
  for (const secret of ['parent01', 'parent@example.com', '김하늘', 'p.png', '2026-12-01']) {
    assert.ok(!raw.includes(secret), `${secret} must not be stored`);
  }
});

test('읽으면 빠진 값은 비운 UserSummary로 돌려준다', () => {
  const { cache } = caches();
  cache.write(remembered, USER);
  assert.deepEqual(cache.read(remembered), {
    id: 'u1',
    role: 'PARENT',
    displayName: '김보호',
    organizationId: null,
    subscriptionStatus: 'ACTIVE',
    grantsAccess: true,
    pendingConsents: ['GUARDIAN'],
    loginId: '',
    email: null,
    childName: null,
    profileImageUrl: null,
    subscriptionExpiresAt: null,
  });
});

test('토큰과 같은 저장소에 둔다 - 로그인 유지가 아니면 sessionStorage', () => {
  const { local, session, cache } = caches();
  cache.write(remembered, USER);
  assert.ok(local.items.has(KEY));
  cache.write(sessionOnly, USER);
  assert.ok(session.items.has(KEY));
  assert.ok(!local.items.has(KEY));
});

test('토큰의 sub·role과 다르면 쓰지 않는다', () => {
  const { cache } = caches();
  cache.write(remembered, USER);
  assert.equal(cache.read(jwt({ sub: 'u2', role: 'PARENT' })), null);
  assert.equal(cache.read(jwt({ sub: 'u1', role: 'TUTOR' })), null);
  assert.equal(cache.read('not-a-jwt'), null);
});

test('clear는 두 저장소 모두에서 지운다', () => {
  const { local, session, cache } = caches();
  local.setItem(KEY, '{}');
  session.setItem(KEY, '{}');
  cache.clear();
  assert.equal(local.items.size + session.items.size, 0);
});

test('깨진 값·저장소 예외에도 던지지 않는다', () => {
  const { local, cache } = caches();
  local.setItem(KEY, '{not json');
  assert.equal(cache.read(remembered), null);
  const throwing = createUserCache({
    local: () => {
      throw new Error('blocked');
    },
    session: () => undefined,
  });
  assert.doesNotThrow(() => throwing.write(remembered, USER));
  assert.equal(throwing.read(remembered), null);
  assert.doesNotThrow(() => throwing.clear());
});
