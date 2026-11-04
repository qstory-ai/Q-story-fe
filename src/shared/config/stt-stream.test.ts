// @ts-nocheck -- Node 테스트 러너 타입을 의도적으로 Expo 번들에서 제외한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { sttStreamUrl } from './stt-stream';

test('web (same-origin proxy) connects straight to the production backend', () => {
  assert.equal(sttStreamUrl('', '/api/qstory'), 'wss://api.qstory.ai.kr/v1/stt/stream');
});

test('app and local builds derive the socket from the absolute API URL', () => {
  assert.equal(
    sttStreamUrl('', 'https://api.qstory.ai.kr/'),
    'wss://api.qstory.ai.kr/v1/stt/stream',
  );
  assert.equal(sttStreamUrl('', 'http://localhost:8080'), 'ws://localhost:8080/v1/stt/stream');
});

test('an explicit stream URL wins', () => {
  assert.equal(sttStreamUrl('wss://staging.example/v1/stt/stream', '/api/qstory'), 'wss://staging.example/v1/stt/stream');
});
