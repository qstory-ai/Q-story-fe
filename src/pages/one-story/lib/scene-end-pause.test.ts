// @ts-nocheck -- Node 테스트 러너 타입은 Expo 번들에서 의도적으로 제외한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { hanselGretelManifest } from '@/entities/story/hansel-gretel/manifest';

import { dialogueResumePlan, isSceneEndClip } from './scene-end-pause';

const manifest = hanselGretelManifest;
const groupOf = (id) => manifest.audioGroups.find((group) => group.id === id);
const anchorAfter = (scene, groupId) =>
  manifest.questionAnchors.some((anchor) => anchor.sceneId === scene.id && anchor.afterAudioGroupId === groupId);

// 질문 초대 없이 다음 장면으로 넘어가는 장면(마지막 묶음 뒤에 앵커가 없고 다음 장면이 있음).
const plainScene = manifest.scenes.find(
  (scene) => scene.nextSceneId && !anchorAfter(scene, scene.audioGroupIds.at(-1)),
);

const stateAt = (scene, groupId, clipIndex) => ({
  status: 'playing-fixed',
  sceneId: scene.id,
  audioGroupId: groupId,
  clipIndex,
});

test('fixture has a scene that flows straight into the next scene', () => {
  assert.ok(plainScene);
});

test('장면의 마지막 대사가 끝나면 다음 장면으로 넘어가기 전 쉼 자리다', () => {
  const lastGroupId = plainScene.audioGroupIds.at(-1);
  const lastGroup = groupOf(lastGroupId);
  const lastIndex = lastGroup.clips.length - 1;
  assert.equal(isSceneEndClip(manifest, stateAt(plainScene, lastGroupId, lastIndex), lastGroup.clips[lastIndex].id), true);
});

test('장면 안의 다음 대사·질문 초대로 가는 대사는 쉬지 않는다', () => {
  const firstGroupId = plainScene.audioGroupIds[0];
  const firstGroup = groupOf(firstGroupId);
  if (firstGroup.clips.length > 1) {
    assert.equal(isSceneEndClip(manifest, stateAt(plainScene, firstGroupId, 0), firstGroup.clips[0].id), false);
  }
  const anchor = manifest.questionAnchors[0];
  const anchorScene = manifest.scenes.find((scene) => scene.id === anchor.sceneId);
  const inviteGroup = groupOf(anchor.afterAudioGroupId);
  const lastIndex = inviteGroup.clips.length - 1;
  assert.equal(
    isSceneEndClip(manifest, stateAt(anchorScene, inviteGroup.id, lastIndex), inviteGroup.clips[lastIndex].id),
    false,
  );
  assert.equal(isSceneEndClip(manifest, { status: 'idle' }, 'x'), false);
});

test('대화를 닫으면: 장면 끝 쉼이면 다음 장면, 낭독 중이었으면 멈춘 문장을 다시, 아니면 그대로', () => {
  assert.equal(dialogueResumePlan({ sceneEndPending: true, status: 'playing-fixed' }), 'advance');
  assert.equal(dialogueResumePlan({ sceneEndPending: false, status: 'playing-fixed' }), 'replay');
  assert.equal(dialogueResumePlan({ sceneEndPending: false, status: 'playing-response' }), 'replay');
  assert.equal(dialogueResumePlan({ sceneEndPending: false, status: 'awaiting-question' }), 'none');
  assert.equal(dialogueResumePlan({ sceneEndPending: true, status: 'awaiting-choice' }), 'none');
});
