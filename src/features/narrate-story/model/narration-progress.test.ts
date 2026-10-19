import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCaptionTrack, captionCueAtProgress } from '@/entities/narration';

import { exposedNarrationProgress } from './narration-progress';

const base = {
  fixedProgress: 0,
  fixedProgressRequestId: 'line-2',
  captionRequestId: 'line-1',
  liveProgress: 0,
  deviceProgress: 0,
};

test('다음 대사를 준비하는 동안(자막은 앞 대사)에는 앞 대사의 끝으로 본다', () => {
  assert.equal(exposedNarrationProgress({ ...base, activeSource: 'fixed' }), 1);
});

test('대사 사이 소리가 없을 때도 끝으로 본다 - 첫 줄 자막이 다시 뜨지 않게', () => {
  assert.equal(exposedNarrationProgress({ ...base, activeSource: null }), 1);
  const track = buildCaptionTrack(
    '먹을 것을 구할 방법이 떠오르지 않던 아버지는 한참을 망설이다가 끝내 고개를 끄덕였어요.',
  );
  const lastCue = captionCueAtProgress(track, 1);
  assert.equal(captionCueAtProgress(track, exposedNarrationProgress({ ...base, activeSource: null })), lastCue);
});

test('재생 중인 대사의 진행률은 그대로 보인다', () => {
  assert.equal(
    exposedNarrationProgress({ ...base, activeSource: 'fixed', fixedProgressRequestId: 'line-1', fixedProgress: 0.4 }),
    0.4,
  );
  assert.equal(exposedNarrationProgress({ ...base, activeSource: 'live', liveProgress: 0.3 }), 0.3);
  assert.equal(exposedNarrationProgress({ ...base, activeSource: 'device', deviceProgress: 0.7 }), 0.7);
});
