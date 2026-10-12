import assert from 'node:assert/strict';
import { test } from 'node:test';

import { pickThinkingFiller, planFillerCut, thinkingFillerClipId } from './dialogue-voice';

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

test('답 첫 소리 전에 채움말이 소리를 내지 않았으면 건너뛴다', () => {
  assert.deepEqual(planFillerCut({ startAt: null, endAt: null }, 5, 4.9), { kind: 'skip' });
  // 예약만 되고 아직 소리 전(답 첫 소리와 같거나 뒤)
  assert.deepEqual(planFillerCut({ startAt: 5.02, endAt: 6 }, 5.0, 4.95), { kind: 'skip' });
  assert.deepEqual(planFillerCut({ startAt: 5, endAt: 6 }, 5, 4.95), { kind: 'skip' });
});

test('채움말이 말하는 중이면 답 첫 소리에 맞춰 줄여 끈다 - 답은 기다리지 않는다', () => {
  // 답이 0.06초 뒤 시작 - 줄일 시간이 모자라 지금부터 0.12초 줄인다(0.06초 겹침).
  const cut = planFillerCut({ startAt: 1.0, endAt: 2.2 }, 1.56, 1.5);
  assert.equal(cut.kind, 'fade');
  if (cut.kind !== 'fade') return;
  assert.equal(cut.from, 1.5);
  assert.ok(Math.abs(cut.to - 1.62) < 1e-9);
  // 답이 넉넉히 뒤면 답 첫 소리 바로 앞에서 다 줄인다.
  const early = planFillerCut({ startAt: 1.0, endAt: 3 }, 2.0, 1.5);
  assert.deepEqual(early, { kind: 'fade', from: 1.88, to: 2.0 });
});

test('채움말이 답 전에 저절로 끝나면 그대로 둔다', () => {
  assert.deepEqual(planFillerCut({ startAt: 1, endAt: 1.8 }, 2.5, 2.4), { kind: 'keep' });
  // 줄이는 사이에 끝나는 꼬리도 그대로
  assert.deepEqual(planFillerCut({ startAt: 1, endAt: 1.6 }, 1.56, 1.5), { kind: 'keep' });
});

test('어느 경우든 답 첫 소리는 채움말 때문에 늦춰지지 않는다', () => {
  for (const startAt of [null, 0.5, 1, 1.4, 2]) {
    for (const length of [0.3, 0.8, 1.5]) {
      for (const replyStartAt of [0.9, 1.2, 1.6, 2.5]) {
        const now = replyStartAt - 0.06;
        const cut = planFillerCut({ startAt, endAt: startAt === null ? null : startAt + length }, replyStartAt, now);
        // 채움말 소리는 답 첫 소리 뒤로 최대 한 번의 줄임(0.12초)만 남는다.
        const fillerSilentAt =
          cut.kind === 'skip' ? now : cut.kind === 'fade' ? cut.to : (startAt ?? 0) + length;
        assert.ok(fillerSilentAt <= Math.max(now, replyStartAt - 0.12) + 0.12 + 1e-9, `${startAt} ${length} ${replyStartAt}`);
      }
    }
  }
});
