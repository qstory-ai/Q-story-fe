// @ts-nocheck -- Node 테스트 러너 타입은 Expo 번들에서 의도적으로 제외한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { STALE_RELOAD_COOLDOWN_MS, isStaleChunkError, reloadForStaleChunk } from './stale-chunk-reload';

const memoryStorage = () => {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) };
};

test('예전 화면 조각을 못 불러온 오류만 알아본다', () => {
  assert.ok(isStaleChunkError('Failed to fetch dynamically imported module: https://demo.qstory.ai.kr/assets/index-CChfqjCF.js'));
  assert.ok(isStaleChunkError('Importing a module script failed.'));
  assert.ok(!isStaleChunkError('Cannot read properties of undefined'));
});

test('한 번 새로 고친 뒤 쿨다운 안에는 다시 새로 고치지 않는다', () => {
  let now = 1_000_000;
  let reloads = 0;
  const deps = { now: () => now, storage: memoryStorage(), reload: () => (reloads += 1) };
  assert.equal(reloadForStaleChunk(deps), true);
  now += 5_000;
  assert.equal(reloadForStaleChunk(deps), false);
  now += STALE_RELOAD_COOLDOWN_MS;
  assert.equal(reloadForStaleChunk(deps), true);
  assert.equal(reloads, 2);
});

test('저장소를 못 써도 새로 고친다', () => {
  let reloads = 0;
  const broken = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {},
  };
  assert.equal(reloadForStaleChunk({ now: () => 1, storage: broken, reload: () => (reloads += 1) }), true);
  assert.equal(reloads, 1);
});
