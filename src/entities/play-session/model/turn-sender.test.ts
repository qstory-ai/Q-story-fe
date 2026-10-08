// @ts-nocheck -- Node 테스트 러너 타입은 Expo 번들에서 의도적으로 제외한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { TurnRecorder } from './turn-recorder';
import { createTurnSender } from './turn-sender';

const BETA = '11111111-2222-4333-8444-555555555555';

function capture(token) {
  const calls = [];
  const send = createTurnSender({
    getToken: () => token.current,
    getBetaSessionId: () => BETA,
    append: async (...args) => {
      calls.push(args);
      return { ok: true, savedThrough: 1 };
    },
  });
  return { calls, send };
}

test('signed-out turns are sent anonymously with the beta session id', async () => {
  const { calls, send } = capture({ current: null });
  const recorder = new TurnRecorder('s-anon', { storyId: 'HG', contentVersion: 'v1' }, { send });
  recorder.record({ role: 'CHILD', sceneId: 'HG-F04', text: '새는 어디 가?' });
  await recorder.flush();
  assert.equal(calls.length, 1);
  const [sentToken, sessionId, batch] = calls[0];
  assert.equal(sentToken, null);
  assert.equal(sessionId, 's-anon');
  assert.equal(batch.betaSessionId, BETA);
  assert.deepEqual(batch.turns.map((turn) => turn.seq), [1]);
});

test('after signing in the token is sent together with the beta session id', async () => {
  const token = { current: null };
  const { calls, send } = capture(token);
  await send('s1', { storyId: 'HG', contentVersion: 'v1', turns: [] });
  token.current = 'jwt';
  await send('s1', { storyId: 'HG', contentVersion: 'v1', turns: [] });
  assert.deepEqual(
    calls.map(([sentToken, , batch]) => [sentToken, batch.betaSessionId]),
    [
      [null, BETA],
      ['jwt', BETA],
    ],
  );
});
