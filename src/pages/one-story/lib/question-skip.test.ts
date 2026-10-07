// @ts-nocheck -- Node 테스트 러너 타입은 Expo 번들에서 의도적으로 제외한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { isAwaitingInviteFor, questionSkipMetadata } from './question-skip';

const awaiting = (anchorId) => ({
  status: 'awaiting-question',
  sceneId: 'S1',
  anchorId,
  questionRound: 1,
  consecutiveSafetyFailures: 0,
});

test('같은 앵커의 질문 초대를 기다리는 중일 때만 참', () => {
  assert.equal(isAwaitingInviteFor(awaiting('A1'), 'A1'), true);
  assert.equal(isAwaitingInviteFor(awaiting('A2'), 'A1'), false);
  assert.equal(isAwaitingInviteFor(awaiting('A1'), null), false);
  assert.equal(isAwaitingInviteFor({ status: 'playing-fixed', sceneId: 'S1' }, 'A1'), false);
  assert.equal(
    isAwaitingInviteFor({ ...awaiting('A1'), status: 'awaiting-clarification', prompt: 'p' }, 'A1'),
    false,
  );
});

test('건너뛴 질문 기록 - 상태별 기본 사유', () => {
  assert.deepEqual(questionSkipMetadata(awaiting('A1')), {
    anchor_id: 'A1',
    scene_id: 'S1',
    skip_reason: 'continue_listening',
  });
  assert.equal(
    questionSkipMetadata({ ...awaiting('A1'), status: 'awaiting-clarification', prompt: 'p' }).skip_reason,
    'clarification_continue',
  );
  assert.equal(
    questionSkipMetadata({ ...awaiting('A1'), status: 'awaiting-safety-retry', prompt: 'p' }).skip_reason,
    'safety_retry_continue',
  );
  assert.equal(questionSkipMetadata({ status: 'playing-fixed', sceneId: 'S1' }), null);
});

test('무응답으로 건너뛰면 사유를 no_speech_timeout으로 남긴다', () => {
  assert.equal(questionSkipMetadata(awaiting('A1'), 'no_speech_timeout').skip_reason, 'no_speech_timeout');
});
