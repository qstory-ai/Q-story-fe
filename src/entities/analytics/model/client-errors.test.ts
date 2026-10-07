// @ts-nocheck -- Node 테스트 러너 타입은 Expo 번들에서 의도적으로 제외한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { MAX_REPORTS, clientErrorPayload, shouldSendClientError } from './client-errors';

test('payload keeps only the path and trims long text', () => {
  const payload = clientErrorPayload(
    { kind: 'PLAYBACK', message: 'x'.repeat(500), stack: 'y'.repeat(2000), storyId: 'HG' },
    '/stories/HG/play?childId=abc',
    'chrome',
  );
  assert.equal(payload.route, '/stories/HG/play');
  assert.equal(payload.message.length, 300);
  assert.equal(payload.stack.length, 1200);
  assert.equal(payload.story_id, 'HG');
  assert.equal('scene_id' in payload, false);
});

test('the same error is sent once and the total is capped', () => {
  const sent = new Set();
  assert.equal(shouldSendClientError({ kind: 'WINDOW_ERROR', message: 'boom' }, sent), true);
  assert.equal(shouldSendClientError({ kind: 'WINDOW_ERROR', message: 'boom' }, sent), false);
  for (let index = 0; index < MAX_REPORTS * 2; index += 1) {
    shouldSendClientError({ kind: 'NETWORK', message: `error ${index}` }, sent);
  }
  assert.equal(sent.size, MAX_REPORTS);
});
