import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createPromiseCache } from './promise-cache';

test('진행 중인 요청과 ttl 안의 응답은 같은 Promise를 돌려준다', async () => {
  let clock = 0;
  let calls = 0;
  const cache = createPromiseCache<number>(1000, () => clock);
  const load = () => Promise.resolve(++calls);
  const first = cache.get('k', load);
  assert.equal(cache.get('k', load), first);
  assert.equal(await first, 1);
  clock = 999;
  assert.equal(await cache.get('k', load), 1);
  clock = 1000;
  assert.equal(await cache.get('k', load), 2);
  assert.equal(calls, 2);
});

test('키가 다르면 따로 보낸다', async () => {
  let calls = 0;
  const cache = createPromiseCache<number>(1000);
  await cache.get('a', () => Promise.resolve(++calls));
  await cache.get('b', () => Promise.resolve(++calls));
  assert.equal(calls, 2);
});

test('실패한 요청은 남기지 않는다', async () => {
  let calls = 0;
  const cache = createPromiseCache<number>(1000);
  await assert.rejects(cache.get('k', () => (++calls, Promise.reject(new Error('down')))));
  assert.equal(await cache.get('k', () => Promise.resolve(++calls)), 2);
});

test('clear 뒤에는 다시 보낸다', async () => {
  let calls = 0;
  const cache = createPromiseCache<number>(1000);
  await cache.get('k', () => Promise.resolve(++calls));
  cache.clear();
  await cache.get('k', () => Promise.resolve(++calls));
  assert.equal(calls, 2);
});
