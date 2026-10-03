// @ts-nocheck -- Node 테스트 러너 타입은 Expo 번들에서 의도적으로 제외한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { hanselGretelStoryPackage as storyPackage } from '@/entities/story/hansel-gretel/manifest';

import { buildDialogueScene, wrapUpFor } from './dialogue-context';

test('scene context carries only what the child has heard so far', () => {
  // F04에서 질문 초대(“저 새를 보니 궁금한 게 있어?”)까지 들은 시점.
  const inviteClip = Object.values(storyPackage.presentation.utteranceByClipId).find(
    (utterance) => utterance.sceneId === 'HG-F04' && utterance.role === 'QUESTION_INVITE:A',
  );
  assert.ok(inviteClip);
  const scene = buildDialogueScene(storyPackage, 'HG-F04', inviteClip.clipId);
  assert.ok(scene);
  assert.equal(scene.title, '자꾸 돌아보는 새');
  assert.equal(scene.recentLines.at(-1), '그레텔: 저 새를 보니 궁금한 게 있어?');
  assert.ok(scene.recentLines.some((line) => line.startsWith('내레이터: 낮은 가지에')));
  // 아직 듣지 않은 대사(새를 따라가 과자집 발견)는 없다.
  assert.ok(scene.recentLines.every((line) => !line.includes('달콤한 냄새')));
  // 지난 장면 줄거리만 - 지금 장면(F04) 줄거리에는 과자집 도착이 들어 있어 넣지 않는다.
  assert.equal(scene.storySoFar.length, 3);
  assert.ok(scene.storySoFar.every((line) => !line.includes('과자집에 도착')));
  assert.match(scene.visual, /WHITE_BIRD/);
});

test('a clip from another scene sends no heard lines rather than the wrong ones', () => {
  const scene = buildDialogueScene(storyPackage, 'HG-F04', 'f01-002');
  assert.deepEqual(scene.recentLines, []);
});

test('turn budget suggests returning after three exchanges and closes after two more', () => {
  assert.equal(wrapUpFor(1, false), 'NONE');
  assert.equal(wrapUpFor(3, false), 'SUGGEST_RETURN');
  assert.equal(wrapUpFor(4, true), 'NONE');
  assert.equal(wrapUpFor(5, true), 'CLOSE');
});
