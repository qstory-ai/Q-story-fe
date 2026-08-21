// @ts-nocheck -- Node test assertions intentionally use test-only globals.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCaptionTrack,
  captionCueAtProgress,
  estimateNarrationDurationSeconds,
} from './caption-sync';

test('문장과 쉼표를 우선해 긴 낭독을 의미 단위로 나눈다', () => {
  const track = buildCaptionTrack(
    '아주 오래전, 커다란 숲 가장자리의 작은 집에 나무꾼 아버지와 그의 아내, 헨젤과 그레텔이 살았어요.',
  );

  assert.ok(track.cues.length >= 3);
  assert.ok(track.cues.some((cue) => cue.text.includes('헨젤과 그레텔')));
  assert.equal(
    track.cues.map((cue) => cue.text).join(' ').replace(/\s+/g, ' '),
    track.transcript,
  );
});

test('음성 재생 기간 힌트를 낭독 문장 길이에 맞게 만든다', () => {
  const short = estimateNarrationDurationSeconds('조심히 살펴보자.');
  const long = estimateNarrationDurationSeconds(
    '조심히 살펴보자. 그리고 서로 신호를 주고받으며 함께 움직이자.',
  );

  assert.ok(short >= 1.5);
  assert.ok(long > short);
});

test('두 어절짜리 고아 꼬리를 단독 자막으로 남기지 않는다', () => {
  const track = buildCaptionTrack(
    '남매는 숲길을 아주 천천히 걸으며 주변의 작은 흔적을 살폈고, 손을 놓지 않았어요.',
  );

  assert.ok(
    track.cues.every(
      (cue) =>
        cue.text.split(/\s+/).length >= 3 ||
        cue.text.replace(/\s/g, '').length >= 8,
    ),
  );
  assert.ok(!track.cues.some((cue) => cue.text === '놓지 않았어요.'));
});

test('화면 폭과 무관한 동일한 cue를 만든다', () => {
  const text =
    '그레텔은 서둘러 다가가지 않고 모르는 척했어요. 먼저 보여주시면 따라 할게요.';
  assert.deepEqual(buildCaptionTrack(text), buildCaptionTrack(text));
});

test('글자 수와 문장부호 pause를 반영한 진행 구간을 만든다', () => {
  const track = buildCaptionTrack(
    '잠깐! 저 문을 먼저 살펴보자. 아주 조심스럽게 다가가 보았어요.',
  );

  assert.equal(track.cues[0].startRatio, 0);
  assert.equal(track.cues.at(-1).endRatio, 1);
  assert.ok(
    track.cues.every(
      (cue, index) =>
        index === 0 || cue.startRatio === track.cues[index - 1].endRatio,
    ),
  );
});

test('실제 재생 진행률 1에서도 마지막 cue를 유지한다', () => {
  const track = buildCaptionTrack(
    '첫 번째 의미 단위 문장입니다. 마지막 의미 단위 문장입니다.',
  );

  assert.equal(captionCueAtProgress(track, 0), track.cues[0].text);
  assert.equal(captionCueAtProgress(track, 1), track.cues.at(-1).text);
});
