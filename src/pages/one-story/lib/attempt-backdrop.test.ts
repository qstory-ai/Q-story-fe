// @ts-nocheck -- Node 테스트 러너 타입은 Expo 번들에서 의도적으로 제외한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BACKDROP_EMPHASIS_SCALE,
  BACKDROP_FADE_MS,
  NO_ATTEMPT_BACKDROP,
  attemptBackdropKey,
  attemptBackdropView,
  backdropMotion,
  blockedLineIndex,
} from './attempt-backdrop';

const NARRATOR = 'HG-SPK-NARRATOR';
const GRETEL = 'HG-SPK-GRETEL';
const images = { 'c-try-high-window': { uri: 'https://cdn.test/c-try-high-window.webp' } };

test('the backdrop changes on the blocked line - the last narrator line, usually the third', () => {
  const scene = [
    { speakerId: NARRATOR, text: '그레텔은 창문 아래로 갔어요.' },
    { speakerId: GRETEL, text: '영차, 조금만 더!' },
    { speakerId: NARRATOR, text: '그레텔은 까치발을 들고 팔을 뻗어 보았지만, 창문이 너무 높았어요.' },
  ];
  assert.equal(blockedLineIndex(scene, NARRATOR), 2);
  // 서버가 그레텔 줄을 버려 두 줄만 왔어도 마지막 내레이터 줄이다.
  assert.equal(blockedLineIndex([scene[0], scene[2]], NARRATOR), 1);
  // 내레이터 줄이 없으면 마지막 줄, 줄이 없으면 바꾸지 않는다.
  assert.equal(blockedLineIndex([scene[1]], NARRATOR), 0);
  assert.equal(blockedLineIndex([], NARRATOR), -1);
});

test('a backdrop shows the chosen picture only while the story waits at the same question', () => {
  const key = attemptBackdropKey('awaiting-question', 6, 'HG-Q-C');
  assert.equal(key, '6:HG-Q-C');
  const state = { assetId: 'c-try-high-window', key };

  assert.deepEqual(attemptBackdropView(state, key, images), {
    kind: 'image',
    assetId: 'c-try-high-window',
    image: images['c-try-high-window'],
  });
  // 이야기로 돌아가거나(질문 초대 밖) 다른 질문 지점·장면이면 원래 그림이다.
  assert.equal(attemptBackdropKey('playing-fixed', 6, 'HG-Q-C'), null);
  assert.deepEqual(attemptBackdropView(state, null, images), NO_ATTEMPT_BACKDROP);
  assert.deepEqual(attemptBackdropView(state, '3:HG-Q-A', images), NO_ATTEMPT_BACKDROP);
  assert.deepEqual(attemptBackdropView(null, key, images), NO_ATTEMPT_BACKDROP);
});

test('no matching picture (or one this story does not have) falls back to emphasising the current picture', () => {
  const key = '6:HG-Q-C';
  assert.deepEqual(attemptBackdropView({ assetId: null, key }, key, images), { kind: 'emphasis' });
  assert.deepEqual(attemptBackdropView({ assetId: 'a-try-thick-bushes', key }, key, images), { kind: 'emphasis' });
});

test('motion: crossfade in about 600ms, slow zoom for the fallback, instant and unzoomed with reduced motion', () => {
  const image = { kind: 'image', assetId: 'c-try-high-window', image: images['c-try-high-window'] };
  assert.deepEqual(backdropMotion(image, false), {
    overlay: 1,
    overlayMs: BACKDROP_FADE_MS,
    emphasis: 0,
    emphasisMs: BACKDROP_FADE_MS,
    scale: BACKDROP_EMPHASIS_SCALE,
  });
  const emphasis = backdropMotion({ kind: 'emphasis' }, false);
  assert.equal(emphasis.overlay, 0);
  assert.equal(emphasis.emphasis, 1);
  assert.ok(emphasis.emphasisMs > BACKDROP_FADE_MS, 'the fallback zoom is slower than the crossfade');
  assert.ok(BACKDROP_EMPHASIS_SCALE > 1 && BACKDROP_EMPHASIS_SCALE <= 1.08);
  // 풀 때는 크로스페이드와 같은 빠르기로 돌아온다.
  assert.deepEqual(backdropMotion(NO_ATTEMPT_BACKDROP, false), {
    overlay: 0,
    overlayMs: BACKDROP_FADE_MS,
    emphasis: 0,
    emphasisMs: BACKDROP_FADE_MS,
    scale: BACKDROP_EMPHASIS_SCALE,
  });
  const reduced = backdropMotion({ kind: 'emphasis' }, true);
  assert.equal(reduced.emphasisMs, 0);
  assert.equal(reduced.overlayMs, 0);
  assert.equal(reduced.scale, 1);
});
