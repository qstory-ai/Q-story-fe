import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { AuthResponse, UserSummary } from '../api/auth-api';
import { verifySession, type SessionDeps } from './verify-session';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 15, 12, 0, 0);

function base64url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function token(expiresInMs: number, tag = 'a'): string {
  const claims = { sub: 'u1', role: 'PARENT', exp: Math.floor((NOW + expiresInMs) / 1000), tag };
  return `${base64url(JSON.stringify({ alg: 'HS256' }))}.${base64url(JSON.stringify(claims))}.sig`;
}

const USER = { id: 'u1', role: 'PARENT', displayName: '김보호' } as UserSummary;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function harness(initial: string) {
  let stored: string | null = initial;
  const calls: string[] = [];
  const me = deferred<UserSummary>();
  const refresh = deferred<AuthResponse>();
  const deps: SessionDeps = {
    fetchCurrentUser: () => {
      calls.push('me');
      return me.promise;
    },
    refreshToken: () => {
      calls.push('refresh');
      return refresh.promise;
    },
    getStoredToken: () => stored,
    storeToken: (next) => {
      stored = next;
    },
    now: () => NOW,
  };
  return {
    deps,
    calls,
    me,
    refresh,
    setStored: (next: string | null) => {
      stored = next;
    },
    stored: () => stored,
  };
}

const unauthorized = () => Object.assign(new Error('unauthorized'), { status: 401 });

test('연장이 필요 없으면 /me 하나만 보내고 그 사용자를 쓴다', async () => {
  const t = token(30 * DAY);
  const h = harness(t);
  const result = verifySession(t, h.deps);
  h.me.resolve(USER);
  assert.deepEqual(await result, { status: 'valid', token: t, user: USER });
  assert.deepEqual(h.calls, ['me']);
});

test('연장이 필요하면 /me와 /refresh를 동시에 보낸다(줄 세우지 않는다)', async () => {
  const t = token(3 * DAY);
  const renewed = token(90 * DAY, 'b');
  const h = harness(t);
  const result = verifySession(t, h.deps);
  // 어느 응답도 오기 전에 두 요청이 모두 나가 있어야 한다.
  assert.deepEqual(h.calls, ['me', 'refresh']);
  h.refresh.resolve({ token: renewed, user: USER });
  h.me.resolve(USER);
  assert.deepEqual(await result, { status: 'valid', token: renewed, user: USER });
  assert.equal(h.stored(), renewed);
});

test('/me가 거절되면 invalid', async () => {
  const t = token(30 * DAY);
  const h = harness(t);
  const result = verifySession(t, h.deps);
  h.me.reject(unauthorized());
  assert.deepEqual(await result, { status: 'invalid' });
});

test('연장이 401이면 /me가 성공해도 invalid', async () => {
  const t = token(3 * DAY);
  const h = harness(t);
  const result = verifySession(t, h.deps);
  h.me.resolve(USER);
  h.refresh.reject(unauthorized());
  assert.deepEqual(await result, { status: 'invalid' });
});

test('연장이 네트워크 오류면 지금 토큰과 /me 사용자를 쓴다', async () => {
  const t = token(3 * DAY);
  const h = harness(t);
  const result = verifySession(t, h.deps);
  h.me.resolve(USER);
  h.refresh.reject(new Error('network'));
  assert.deepEqual(await result, { status: 'valid', token: t, user: USER });
});

test('이미 만료된 토큰은 요청 없이 invalid', async () => {
  const t = token(-DAY);
  const h = harness(t);
  assert.deepEqual(await verifySession(t, h.deps), { status: 'invalid' });
  assert.deepEqual(h.calls, []);
});

test('기다리는 사이 로그아웃했으면 stale - 상태를 덮어쓰지 않는다', async () => {
  const t = token(30 * DAY);
  const h = harness(t);
  const result = verifySession(t, h.deps);
  h.setStored(null);
  h.me.reject(unauthorized());
  assert.deepEqual(await result, { status: 'stale' });
});

test('기다리는 사이 다른 계정으로 로그인했으면 stale', async () => {
  const t = token(30 * DAY);
  const h = harness(t);
  const result = verifySession(t, h.deps);
  h.setStored(token(30 * DAY, 'other'));
  h.me.resolve(USER);
  assert.deepEqual(await result, { status: 'stale' });
});
