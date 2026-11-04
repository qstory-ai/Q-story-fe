// @ts-nocheck -- Node 테스트 러너 타입을 의도적으로 Expo 번들에서 제외한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  STT_UNAVAILABLE_CHILD_COPY,
  STT_UNAVAILABLE_CODE,
  isSttUnavailableBody,
  isSttUnavailableCode,
} from './stt-unavailable';

test('classifies the FailureBody envelope with STT_UNAVAILABLE', () => {
  assert.equal(
    isSttUnavailableBody({ ok: false, failure: { code: 'STT_UNAVAILABLE', stage: 'stt' } }),
    true,
  );
});

test('does not classify other failures or malformed bodies', () => {
  assert.equal(isSttUnavailableBody({ ok: false, failure: { code: 'EMPTY_AUDIO' } }), false);
  assert.equal(isSttUnavailableBody({ ok: false }), false);
  assert.equal(isSttUnavailableBody(null), false);
  assert.equal(isSttUnavailableBody('STT_UNAVAILABLE'), false);
  assert.equal(isSttUnavailableCode('STT_UNAVAILABLE'), true);
  assert.equal(isSttUnavailableCode(undefined), false);
});

test('child copy matches the agreed wording', () => {
  assert.equal(STT_UNAVAILABLE_CODE, 'STT_UNAVAILABLE');
  assert.equal(STT_UNAVAILABLE_CHILD_COPY, '지금은 말로 질문하기가 어려워요. 글로 물어봐 줄래?');
});
