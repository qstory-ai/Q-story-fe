// @ts-nocheck -- Node 테스트 러너 타입은 Expo 번들에서 의도적으로 제외한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { hanselGretelStoryPackage as storyPackage } from '@/test-fixtures/hansel-gretel/manifest';

import { inviteNeedsLiveNarration, questionInviteClipId } from './question-invite-audio';

test('질문 초대 클립은 앵커 앞 묶음의 QUESTION_INVITE 대사다', () => {
  const anchors = storyPackage.manifest.questionAnchors;
  assert.ok(anchors.length >= 3);
  for (const anchor of anchors) {
    const clipId = questionInviteClipId(storyPackage, anchor);
    assert.ok(clipId, anchor.id);
    assert.match(storyPackage.presentation.utteranceByClipId[clipId].role, /^QUESTION_INVITE:/);
    assert.equal(storyPackage.presentation.utteranceByClipId[clipId].text, anchor.prompt);
  }
});

test('헨젤과 그레텔의 질문 초대는 모두 미리 녹음돼 있어 실시간 TTS를 부르지 않는다', () => {
  for (const anchor of storyPackage.manifest.questionAnchors) {
    assert.equal(inviteNeedsLiveNarration(storyPackage, anchor), false, anchor.id);
  }
});

test('고정 음성이 없는 초대만 실시간으로 만든다', () => {
  const anchor = storyPackage.manifest.questionAnchors[0];
  const clipId = questionInviteClipId(storyPackage, anchor);
  const withoutClip = { ...storyPackage, audioAssets: { ...storyPackage.audioAssets, [clipId]: undefined } };
  assert.equal(inviteNeedsLiveNarration(withoutClip, anchor), true);
  assert.equal(inviteNeedsLiveNarration(storyPackage, { afterAudioGroupId: 'missing' }), true);
});
