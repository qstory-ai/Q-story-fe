import assert from 'node:assert/strict';
import { test } from 'node:test';

import { pickThinkingFiller, thinkingFillerClipId } from './dialogue-voice';

test('채움말 녹음 id는 1부터 센다(assets.json slug)', () => {
  assert.equal(thinkingFillerClipId(0), 'dialogue-thinking-1');
  assert.equal(thinkingFillerClipId(3), 'dialogue-thinking-4');
});

test('바로 앞에 쓴 채움말은 다시 고르지 않는다', () => {
  for (let previous = 0; previous < 4; previous += 1) {
    for (const random of [0, 0.34, 0.67, 0.999]) {
      const picked = pickThinkingFiller(4, previous, () => random);
      assert.notEqual(picked, previous);
      assert.ok(picked !== null && picked >= 0 && picked < 4);
    }
  }
});

test('채움말이 없거나 하나뿐이면 그대로', () => {
  assert.equal(pickThinkingFiller(0, null), null);
  assert.equal(pickThinkingFiller(1, 0), 0);
  assert.equal(pickThinkingFiller(3, null, () => 0.5), 1);
});
