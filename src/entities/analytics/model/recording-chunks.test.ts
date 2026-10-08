// @ts-nocheck -- Node 테스트 러너 타입은 Expo 번들에서 의도적으로 제외한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { RecordingStateStore, decodeEvents, encodeEvents, encodeGroup, eventsJson, groupEventStrings } from './recording-chunks';

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('events are grouped by JSON length without reordering', () => {
  const events = ['"a"', '"bb"', '"ccc"', '"dddd"'];
  const groups = groupEventStrings(events, 12);
  assert.ok(groups.length > 1);
  assert.deepEqual(groups.flat(), events);
  for (const group of groups) assert.ok(eventsJson(group).length <= 12);
  assert.equal(groupEventStrings([JSON.stringify('x'.repeat(50))], 12).length, 1, 'an oversized event stays alone');
});

test('gzip-base64 round trips through decodeEvents', async () => {
  const events = Array.from({ length: 200 }, (_, index) => ({ type: 3, timestamp: 1_000 + index, data: { source: 1 } }));
  const json = JSON.stringify(events);
  const encoded = await encodeEvents(json);
  assert.equal(encoded.encoding, 'gzip-base64');
  assert.ok(encoded.data.length < json.length);
  assert.deepEqual(await decodeEvents(encoded.encoding, encoded.data), events);
  assert.deepEqual(await decodeEvents('json', '[1,2]'), [1, 2]);
});

test('a group whose encoded data is too long is split in halves; a single oversized event is dropped', async () => {
  // 무작위 문자열은 압축이 잘 안 된다 - 한도를 작게 줘서 나뉘는지 본다.
  const random = (index) =>
    JSON.stringify({ type: 3, timestamp: index, data: Array.from({ length: 30 }, () => Math.random().toString(36)).join('') });
  const events = Array.from({ length: 8 }, (_, index) => random(index));
  const pieces = await encodeGroup(events, 1_500);
  assert.ok(pieces.length > 1);
  assert.deepEqual(pieces.flatMap((piece) => piece.events), events);
  for (const piece of pieces) assert.ok(piece.data.length <= 1_500);
  assert.deepEqual(await encodeGroup([random(0)], 10), []);
});

test('seq continues across reloads for the same beta session and restarts for a new one', () => {
  const storage = memoryStorage();
  const first = new RecordingStateStore(storage);
  assert.equal(first.takeSeq('beta-1'), 0);
  assert.equal(first.takeSeq('beta-1'), 1);
  first.addUploaded('beta-1', 500);
  const reloaded = new RecordingStateStore(storage);
  assert.equal(reloaded.takeSeq('beta-1'), 2);
  assert.equal(reloaded.load('beta-1').uploadedBytes, 500);
  reloaded.markCapped('beta-1');
  assert.equal(new RecordingStateStore(storage).load('beta-1').capped, true);
  assert.equal(new RecordingStateStore(storage).takeSeq('beta-2'), 0);
});

test('the state store counts in memory without storage', () => {
  const store = new RecordingStateStore(null);
  assert.equal(store.takeSeq('b'), 0);
  assert.equal(store.takeSeq('b'), 1);
});
