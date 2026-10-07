// @ts-nocheck -- Node 테스트 러너 타입은 Expo 번들에서 의도적으로 제외한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { hanselGretelStoryPackage as storyPackage } from '@/entities/story/hansel-gretel/manifest';

import {
  classSceneRows,
  evidenceTurns,
  groupExchanges,
  inputTags,
  readAgainChoice,
  readRangeLabel,
  skippedInviteScenes,
  storyChanges,
} from './session-report';

const turns = [
  { seq: 1, occurredAt: '', sceneId: 'HG-F04', role: 'CHARACTER', text: '저 새를 보니 궁금한 게 있어?', fixed: true, visualId: 'white-bird-leads' },
  { seq: 2, occurredAt: '', sceneId: 'HG-F04', role: 'CHILD', text: '새는 어디 가?', inputMode: 'VOICE', speaker: 'UNVERIFIED', transcriptEdited: false, visualId: 'white-bird-leads' },
  { seq: 3, occurredAt: '', sceneId: 'HG-F04', role: 'CHARACTER', text: '나도 몰라. 같이 지켜볼까?', replyKind: 'ANSWER' },
  { seq: 4, occurredAt: '', sceneId: 'HG-F04', role: 'CHILD', text: '응 보자', inputMode: 'VOICE', transcriptEdited: true },
  { seq: 5, occurredAt: '', sceneId: 'HG-F04', role: 'SYSTEM', event: 'ACTION_CONFIRMED', familyId: 'A_OBSERVE_BIRD', viaSuggestion: false },
  { seq: 6, occurredAt: '', sceneId: 'HG-F05', role: 'CHARACTER', text: '우린 이 집에 처음 왔어.', fixed: true },
  { seq: 7, occurredAt: '', sceneId: 'HG-F05', role: 'SYSTEM', event: 'INVITE_SKIPPED' },
  { seq: 8, occurredAt: '', sceneId: 'HG-F07', role: 'SYSTEM', event: 'ACTION_CONFIRMED', familyId: 'C_WAIT_FOR_WITCH_TURN', viaSuggestion: true, suggestionLabel: '등 돌릴 때 기다리기' },
];

test('exchanges keep the actual words: line before, the child line, and the reply', () => {
  const exchanges = groupExchanges(storyPackage, turns);
  assert.equal(exchanges.length, 1, 'scenes where the child said nothing are left out');
  const [bird] = exchanges;
  assert.equal(bird.sceneId, 'HG-F04');
  assert.deepEqual(bird.lead.map((turn) => turn.seq), [1, 2, 3]);
  assert.deepEqual(bird.rest.map((turn) => turn.seq), [4, 5]);
  assert.equal(bird.visualId, 'white-bird-leads');
  assert.equal(bird.sceneTitle, '자꾸 돌아보는 새');
});

test('story changes come from confirmed actions and keep the example-picked mark', () => {
  const changes = storyChanges(storyPackage, turns, []);
  assert.deepEqual(changes.map((change) => change.familyId), ['A_OBSERVE_BIRD', 'C_WAIT_FOR_WITCH_TURN']);
  assert.equal(changes[1].viaSuggestion, true);
  assert.equal(changes[1].suggestionLabel, '등 돌릴 때 기다리기');
  assert.ok(changes[0].summary);
  assert.ok(changes[0].resultVisualId);
});

test('old records without turns fall back to saved outcomes', () => {
  const changes = storyChanges(storyPackage, [], [
    { anchorId: 'HG-Q-C', childRelevantMeaning: '도움 예시를 골랐어요', route: 'DIRECT_ACTION', responseText: '', actionFamilyId: 'C_DISTRACT_AND_TAKE_KEYS', viaSuggestion: true },
  ]);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].sceneId, 'HG-F07');
  assert.equal(changes[0].viaSuggestion, true);
});

test('input tags say how the words came in', () => {
  assert.deepEqual(inputTags(turns[1]), ['음성 인식 문장']);
  assert.deepEqual(inputTags(turns[3]), ['음성 인식 문장', '고쳐 씀']);
  assert.deepEqual(inputTags({ ...turns[1], speaker: 'GUARDIAN_PROXY', inputMode: 'TEXT' }), ['보호자가 대신 입력', '글로 입력']);
  assert.deepEqual(inputTags(turns[0]), []);
});

test('read range reads like the report sentence', () => {
  assert.equal(readRangeLabel(storyPackage, 'HG-F01', 'HG-F10', 'COMPLETED'), '1~10화 끝까지 읽음');
  assert.equal(readRangeLabel(storyPackage, 'HG-F01', 'HG-F06', 'EXITED'), '1~6화까지 읽고 멈춤');
});

test('class rows show what was sent, the reply and what happened per scene', () => {
  const rows = classSceneRows(storyPackage, turns);
  assert.equal(rows[0].sceneId, 'HG-F04');
  assert.deepEqual(rows[0].sent, ['새는 어디 가?', '응 보자']);
  assert.deepEqual(rows[0].replies, ['나도 몰라. 같이 지켜볼까?']);
  assert.match(rows[0].result, /새/);
  assert.equal(rows[1].result, '건너뜀 - 원래 이야기대로');
  assert.deepEqual(skippedInviteScenes(storyPackage, turns), ['5화 과자집 문 앞의 초대']);
});

test('evidence resolves only to child lines', () => {
  assert.deepEqual(evidenceTurns(turns, [1, 2, 4]).map((turn) => turn.seq), [2, 4]);
});

test('read again picks the only linked child or asks to choose', () => {
  assert.deepEqual(readAgainChoice([]), { kind: 'none' });
  assert.deepEqual(readAgainChoice([{ id: 'c1', name: '서아' }]), { kind: 'one', childId: 'c1' });
  assert.equal(readAgainChoice([{ id: 'c1', name: '서아' }, { id: 'c2', name: '도윤' }]).kind, 'pick');
});
