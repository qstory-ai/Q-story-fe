// @ts-nocheck -- Node 테스트 러너 타입은 Expo 번들에서 의도적으로 제외한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { NO_ATTEMPTS, attemptAfterReply, attemptOnClose, attemptRequest, inAttempt } from './dialogue-attempt';

const QC = 'HG-Q-C';
const start = {
  anchorId: QC,
  mode: 'INVITE',
  replyKind: 'TRY_FAIL',
  proposedActionFamilyId: null,
  childWantsToEnd: false,
  attempt: {
    scene: [
      { speakerId: 'HG-SPK-NARRATOR', text: '그레텔은 창문 아래로 가 보았어요. 하지만 창문이 너무 높았어요.' },
      { speakerId: 'HG-SPK-GRETEL', text: '으음, 손이 안 닿아.' },
    ],
    maxTurns: 4,
  },
  tried: '창문으로 나가기',
  responseText: '창문이 너무 높아… 뭘 밟고 올라갈까?',
};
const talk = { ...start, replyKind: 'ANSWER', attempt: undefined, tried: '의자 밟기', responseText: '그래도 안 닿아.' };

test('an attempt starts a scene, is sent back with each turn, and ends at the turn limit back at the question', () => {
  const started = attemptAfterReply(NO_ATTEMPTS, start);
  assert.deepEqual(started.event, { kind: 'START', anchorId: QC, tried: '창문으로 나가기', sceneLineCount: 2 });
  assert.equal(inAttempt(started.state, QC), true);
  assert.deepEqual(attemptRequest(started.state, QC), {
    tried: 1,
    active: {
      tried: '창문으로 나가기',
      scene: '그레텔은 창문 아래로 가 보았어요. 하지만 창문이 너무 높았어요. / 으음, 손이 안 닿아. / 창문이 너무 높아… 뭘 밟고 올라갈까?',
      turn: 1,
    },
  });

  let state = started.state;
  for (let turn = 1; turn <= 3; turn += 1) {
    const next = attemptAfterReply(state, talk);
    assert.equal(next.event, null, `turn ${turn} stays in the scene`);
    state = next.state;
    assert.equal(attemptRequest(state, QC).active.turn, turn + 1);
  }
  const last = attemptAfterReply(state, talk);
  assert.deepEqual(last.event, { kind: 'END', anchorId: QC, tried: '창문으로 나가기', turns: 4, reason: 'LIMIT' });
  assert.equal(inAttempt(last.state, QC), false);
  // 원래 질문 지점으로 돌아와도 이 지점에서 만든 장면 수는 남는다(질문 지점당 상한).
  assert.deepEqual(attemptRequest(last.state, QC), { tried: 1, active: null });
});

test('the child can stop the scene, or jump to a prepared action from inside it', () => {
  const { state } = attemptAfterReply(NO_ATTEMPTS, start);
  assert.equal(attemptAfterReply(state, { ...talk, replyKind: 'ATTEMPT_END' }).event.reason, 'RETURN');
  assert.equal(
    attemptAfterReply(state, { ...talk, proposedActionFamilyId: 'C_WAIT_FOR_WITCH_TURN' }).event.reason,
    'ACTION',
  );
  assert.equal(attemptAfterReply(state, { ...talk, replyKind: 'CLOSE' }).event.reason, 'CLOSED');
  assert.deepEqual(attemptOnClose(state).event, {
    kind: 'END', anchorId: QC, tried: '창문으로 나가기', turns: 0, reason: 'CLOSED',
  });
  assert.equal(attemptOnClose(NO_ATTEMPTS).event, null);
});

test('outside an invite or without a scene nothing changes', () => {
  assert.equal(attemptAfterReply(NO_ATTEMPTS, { ...start, mode: 'CHAT' }).event, null);
  assert.equal(attemptAfterReply(NO_ATTEMPTS, { ...start, anchorId: null }).event, null);
  assert.equal(attemptAfterReply(NO_ATTEMPTS, { ...start, attempt: undefined }).event, null);
  assert.equal(attemptAfterReply(NO_ATTEMPTS, talk).event, null);
  // 다른 질문 지점의 장면은 이 지점 장면이 아니다.
  const { state } = attemptAfterReply(NO_ATTEMPTS, start);
  assert.deepEqual(attemptRequest(state, 'HG-Q-A'), { tried: 0, active: null });
});

test('backdrop candidates ride along only while a new attempt scene can start', () => {
  const backdrops = [
    { id: 'c-try-high-window', description: '까치발로 팔을 뻗어도 높은 창문에 손이 닿지 않음', extra: 'dropped' },
  ];
  assert.deepEqual(attemptRequest(NO_ATTEMPTS, QC, backdrops), {
    tried: 0,
    active: null,
    backdrops: [{ id: 'c-try-high-window', description: '까치발로 팔을 뻗어도 높은 창문에 손이 닿지 않음' }],
  });
  // 장면 안에서는 새 그림을 고르지 않는다.
  const { state } = attemptAfterReply(NO_ATTEMPTS, start);
  assert.equal('backdrops' in attemptRequest(state, QC, backdrops), false);
  // 후보가 없는 질문 지점은 예전과 같은 모양이다.
  assert.deepEqual(attemptRequest(NO_ATTEMPTS, QC, []), { tried: 0, active: null });
});
