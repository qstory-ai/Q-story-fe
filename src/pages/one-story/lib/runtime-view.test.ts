// @ts-nocheck -- Node 테스트 러너 타입은 Expo 번들에서 의도적으로 제외한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { questionAnchorId, sceneId } from '@/entities/story-runtime';
import { hanselGretelManifest } from '@/entities/story/hansel-gretel/manifest';

import { splitQuestionOutcomesAtScene } from './runtime-view';

const manifest = hanselGretelManifest;

// 매니페스트에서 앵커들을 장면 순서대로 뽑는다 - 앵커 id/장면 id를 하드코딩하지 않아 콘텐츠가
// 바뀌어도 테스트가 그대로 유효하다(단, 질문 앵커가 서로 다른 장면에 최소 2개는 있어야 한다).
const sceneIndexOf = (id) => manifest.scenes.findIndex((scene) => scene.id === id);
const anchorsInOrder = [...manifest.questionAnchors].sort(
  (a, b) => sceneIndexOf(a.sceneId) - sceneIndexOf(b.sceneId),
);
const outcomeFor = (anchor) => ({
  anchorId: questionAnchorId(anchor.id),
  childRelevantMeaning: `meaning for ${anchor.id}`,
  route: 'DIRECT_ACTION',
  responseText: 'ok',
});

test('fixture has question anchors in at least two distinct scenes', () => {
  const distinctScenes = new Set(anchorsInOrder.map((anchor) => anchor.sceneId));
  assert.ok(distinctScenes.size >= 2);
});

test('rewinding to a scene keeps outcomes from earlier scenes and discards the rest', () => {
  const [first, ...later] = anchorsInOrder;
  const lastAnchor = later.at(-1);
  const outcomes = [outcomeFor(first), outcomeFor(lastAnchor)];

  const { kept, discarded } = splitQuestionOutcomesAtScene(
    outcomes,
    manifest,
    lastAnchor.sceneId,
  );

  assert.deepEqual(kept.map((o) => o.anchorId), [first.id]);
  assert.deepEqual(discarded.map((o) => o.anchorId), [lastAnchor.id]);
});

test('rewinding to the scene of an anchor discards that anchor (target scene replays)', () => {
  const [first] = anchorsInOrder;
  const { kept, discarded } = splitQuestionOutcomesAtScene(
    [outcomeFor(first)],
    manifest,
    first.sceneId,
  );
  assert.equal(kept.length, 0);
  assert.equal(discarded.length, 1);
});

test('rewinding to the entry scene discards everything', () => {
  const outcomes = anchorsInOrder.map(outcomeFor);
  const { kept, discarded } = splitQuestionOutcomesAtScene(
    outcomes,
    manifest,
    manifest.entrySceneId,
  );
  assert.equal(kept.length, 0);
  assert.equal(discarded.length, outcomes.length);
});

test('rewinding past the last anchor keeps everything', () => {
  const outcomes = anchorsInOrder.map(outcomeFor);
  const { kept, discarded } = splitQuestionOutcomesAtScene(
    outcomes,
    manifest,
    manifest.endingSceneId,
  );
  // 마지막 장면에 앵커가 있다면 그것만 버려진다; 없다면 전부 유지된다.
  const anchorsOnEnding = anchorsInOrder.filter(
    (anchor) => anchor.sceneId === manifest.endingSceneId,
  ).length;
  assert.equal(discarded.length, anchorsOnEnding);
  assert.equal(kept.length, outcomes.length - anchorsOnEnding);
});

test('unknown anchors or scenes are treated conservatively (discarded)', () => {
  const ghost = {
    anchorId: questionAnchorId('NOPE-Q-Z'),
    childRelevantMeaning: 'ghost',
    route: 'DIRECT_ACTION',
    responseText: 'ok',
  };
  assert.equal(
    splitQuestionOutcomesAtScene([ghost], manifest, manifest.endingSceneId).discarded.length,
    1,
  );
  assert.equal(
    splitQuestionOutcomesAtScene(
      [outcomeFor(anchorsInOrder[0])],
      manifest,
      sceneId('NOPE-F99'),
    ).discarded.length,
    1,
  );
});
