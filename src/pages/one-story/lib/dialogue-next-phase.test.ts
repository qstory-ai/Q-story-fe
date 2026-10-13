// @ts-nocheck -- Node 테스트 러너 타입은 Expo 번들에서 의도적으로 제외한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { nextDialogueStep } from './dialogue-next-phase';

const base = {
  replyKind: 'ANSWER',
  childWantsToEnd: false,
  asksForHelp: false,
  proposedActionFamilyId: null,
  mode: 'INVITE',
  wrapUp: 'NONE',
  helpAvailable: true,
};

test('a failure scene goes back to the same question point - no action, no help offer, no return offer', () => {
  // 서버가 실패 장면에 행동 제안·도움 요청을 실어 보내도(검증에서 지우지만) 실행 확인으로 가지 않는다.
  const step = nextDialogueStep({
    ...base,
    replyKind: 'TRY_FAIL',
    proposedActionFamilyId: 'C_WAIT_FOR_WITCH_TURN',
    asksForHelp: true,
    wrapUp: 'SUGGEST_RETURN',
  });
  assert.deepEqual(step, { ending: false, phase: 'ready', attemptTurn: true });
});

test('ending an attempt scene also goes back to the question point', () => {
  assert.deepEqual(nextDialogueStep({ ...base, replyKind: 'ATTEMPT_END', wrapUp: 'SUGGEST_RETURN' }), {
    ending: false,
    phase: 'ready',
    attemptTurn: true,
  });
});

test('a failure scene still respects the hard dialogue limit', () => {
  assert.equal(nextDialogueStep({ ...base, replyKind: 'TRY_FAIL', wrapUp: 'CLOSE' }).ending, true);
});

test('outside a question invite a failure kind is just an answer', () => {
  const step = nextDialogueStep({ ...base, replyKind: 'TRY_FAIL', mode: 'CHAT' });
  assert.equal(step.attemptTurn, false);
  assert.equal(step.phase, 'ready');
});

test('ordinary replies keep their old next steps', () => {
  assert.equal(nextDialogueStep({ ...base, proposedActionFamilyId: 'C_DISTRACT_AND_TAKE_KEYS' }).phase, 'proposal');
  assert.equal(nextDialogueStep({ ...base, mode: 'CHAT', proposedActionFamilyId: 'X' }).phase, 'ready');
  assert.equal(nextDialogueStep({ ...base, asksForHelp: true }).phase, 'offer-help');
  assert.equal(nextDialogueStep({ ...base, asksForHelp: true, helpAvailable: false }).phase, 'ready');
  assert.equal(nextDialogueStep({ ...base, wrapUp: 'SUGGEST_RETURN' }).phase, 'suggest-return');
  // 안전 리다이렉트는 지금처럼 아이 차례로 돌아온다.
  assert.deepEqual(nextDialogueStep({ ...base, replyKind: 'REDIRECT' }), { ending: false, phase: 'ready', attemptTurn: false });
  assert.equal(nextDialogueStep({ ...base, replyKind: 'CLOSE' }).ending, true);
  assert.equal(nextDialogueStep({ ...base, childWantsToEnd: true }).ending, true);
});
