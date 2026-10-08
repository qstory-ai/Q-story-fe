import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createTokenStore,
  tokenExpiresAtMs,
  tokenIsExpired,
  tokenNeedsRenewal,
  tokenRemembersLogin,
} from './session';

const KEY = 'qstory.auth.session.v1';
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 9, 8, 12, 0, 0);

function base64url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** 서명은 검증하지 않으므로 아무 문자열이나 붙인다. */
function jwt(claims: Record<string, unknown>): string {
  return `${base64url(JSON.stringify({ alg: 'HS256' }))}.${base64url(JSON.stringify(claims))}.sig`;
}

function token(rm: boolean | undefined, expiresInMs: number): string {
  const claims: Record<string, unknown> = { sub: 'u1', role: 'PARENT', exp: Math.floor((NOW + expiresInMs) / 1000) };
  if (rm !== undefined) claims.rm = rm;
  return jwt(claims);
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

function stores() {
  const local = new MemoryStorage();
  const session = new MemoryStorage();
  return { local, session, store: createTokenStore({ local: () => local, session: () => session }) };
}

test('rm claim을 읽는다 - 없으면(예전 토큰·회원가입) 로그인 유지로 본다', () => {
  assert.equal(tokenRemembersLogin(token(true, DAY)), true);
  assert.equal(tokenRemembersLogin(token(false, DAY)), false);
  assert.equal(tokenRemembersLogin(token(undefined, DAY)), true);
  assert.equal(tokenRemembersLogin('not-a-jwt'), true);
});

test('exp를 ms로 읽는다 - 한글 claim이 있어도 깨지지 않는다', () => {
  const t = jwt({ exp: 1_800_000_000, name: '김하늘' });
  assert.equal(tokenExpiresAtMs(t), 1_800_000_000_000);
  assert.equal(tokenExpiresAtMs(jwt({})), null);
  assert.equal(tokenExpiresAtMs('a.%%%.c'), null);
});

test('로그인 유지 토큰은 localStorage에, 아닌 토큰은 sessionStorage에 둔다', () => {
  const remembered = stores();
  remembered.store.store(token(true, 90 * DAY));
  assert.ok(remembered.local.items.has(KEY));
  assert.ok(!remembered.session.items.has(KEY));

  const legacy = stores();
  legacy.store.store(token(undefined, 14 * DAY));
  assert.ok(legacy.local.items.has(KEY));

  const sessionOnly = stores();
  const t = token(false, 12 * HOUR);
  sessionOnly.store.store(t);
  assert.equal(sessionOnly.session.getItem(KEY), t);
  assert.ok(!sessionOnly.local.items.has(KEY));
  assert.equal(sessionOnly.store.get(), t);
});

test('모드가 바뀌면 다른 쪽 저장소의 토큰은 지운다', () => {
  const { local, session, store } = stores();
  store.store(token(true, 90 * DAY));
  const sessionToken = token(false, 12 * HOUR);
  store.store(sessionToken);
  assert.ok(!local.items.has(KEY));
  assert.equal(store.get(), sessionToken);

  const rememberToken = token(true, 90 * DAY);
  store.store(rememberToken);
  assert.ok(!session.items.has(KEY));
  assert.equal(store.get(), rememberToken);
});

test('get은 두 저장소를 모두 본다, clear는 둘 다 지운다', () => {
  const { local, session, store } = stores();
  local.setItem(KEY, 'L');
  assert.equal(store.get(), 'L');
  session.setItem(KEY, 'S');
  assert.equal(store.get(), 'S');
  store.clear();
  assert.equal(store.get(), null);
  assert.ok(!local.items.has(KEY) && !session.items.has(KEY));
});

test('저장소가 없거나 던져도 로그인 흐름을 막지 않는다', () => {
  const throwing = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
    removeItem: () => {
      throw new Error('blocked');
    },
  };
  const store = createTokenStore({ local: () => throwing, session: () => undefined });
  assert.doesNotThrow(() => store.store(token(true, DAY)));
  assert.doesNotThrow(() => store.clear());
  assert.equal(store.get(), null);
});

test('로그인 유지 토큰은 만료 7일 전부터 연장한다', () => {
  assert.equal(tokenNeedsRenewal(token(true, 30 * DAY), NOW), false);
  assert.equal(tokenNeedsRenewal(token(true, 7 * DAY + HOUR), NOW), false);
  assert.equal(tokenNeedsRenewal(token(true, 7 * DAY), NOW), true);
  assert.equal(tokenNeedsRenewal(token(true, HOUR), NOW), true);
  // rm 없는 예전 14일 토큰도 같은 규칙
  assert.equal(tokenNeedsRenewal(token(undefined, 6 * DAY), NOW), true);
});

test('유지 안 함 토큰은 만료 2시간 전부터 연장한다', () => {
  assert.equal(tokenNeedsRenewal(token(false, 11 * HOUR), NOW), false);
  assert.equal(tokenNeedsRenewal(token(false, 2 * HOUR + 60_000), NOW), false);
  assert.equal(tokenNeedsRenewal(token(false, 2 * HOUR), NOW), true);
  assert.equal(tokenNeedsRenewal(token(false, 60_000), NOW), true);
});

test('이미 만료됐거나 exp가 없으면 연장하지 않는다(만료는 따로 로그아웃)', () => {
  const expired = token(true, -60_000);
  assert.equal(tokenNeedsRenewal(expired, NOW), false);
  assert.equal(tokenIsExpired(expired, NOW), true);
  assert.equal(tokenIsExpired(token(false, 60_000), NOW), false);
  assert.equal(tokenNeedsRenewal(jwt({ rm: false }), NOW), false);
  assert.equal(tokenIsExpired(jwt({ rm: false }), NOW), false);
});
