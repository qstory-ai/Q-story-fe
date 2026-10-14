// @ts-nocheck -- Node 테스트 러너의 assertion들이 생성된 콘텐츠를 의도적으로 검사한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { generatedHanselGretelContent } from './generated-content';
import {
  hanselGretelVisualGenerationBriefs,
  hanselGretelVisualReferencePacks,
  visualGenerationBriefForId,
} from './visual-generation-contract';

const visuals = generatedHanselGretelContent.scenes.flatMap(
  (scene) => scene.visuals,
);
const approvedAssetIds = new Set(visuals.map((visual) => visual.assetId));

test('every fixed visual has a versioned reference-guided generation brief', () => {
  assert.equal(hanselGretelVisualGenerationBriefs.length, 40);
  assert.deepEqual(
    hanselGretelVisualGenerationBriefs.map((brief) => brief.visualId),
    visuals.map((visual) => visual.id),
  );
  assert.equal(
    new Set(
      hanselGretelVisualGenerationBriefs.map(
        (brief) => brief.targetAssetId,
      ),
    ).size,
    40,
  );

  for (const brief of hanselGretelVisualGenerationBriefs) {
    assert.equal(brief.schemaVersion, 1);
    assert.equal(brief.stylePackId, 'HG-STYLE-STORYBOOK-V1');
    assert.ok(brief.characterPackIds.length > 0);
    assert.ok(brief.locationPackId.startsWith('HG-LOC-'));
    assert.ok(brief.referenceAssetIds.includes(brief.targetAssetId));
    assert.ok(brief.referenceAssetIds.length >= 3);
    assert.ok(
      brief.referenceAssetIds.every((assetId) =>
        approvedAssetIds.has(assetId),
      ),
      `${brief.visualId} references an unapproved asset`,
    );
    assert.ok(brief.prompt.includes(brief.requiredFacts.action));
    assert.ok(brief.reviewChecklist.length >= 6);
    assert.match(brief.negativePrompt, /different face or age/);
    assert.match(brief.negativePrompt, /contradictory time or location/);
  }
});

test('each sequential brief carries the immediately previous approved asset', () => {
  for (
    let index = 1;
    index < hanselGretelVisualGenerationBriefs.length;
    index += 1
  ) {
    const previous = hanselGretelVisualGenerationBriefs[index - 1];
    const current = hanselGretelVisualGenerationBriefs[index];
    assert.equal(current.previousVisualId, previous.visualId);
    assert.equal(current.previousAssetId, previous.targetAssetId);
    assert.ok(current.referenceAssetIds.includes(previous.targetAssetId));
  }
});

test('F06-F07 kitchen images keep the two-key escape in order with shared props', () => {
  const locked = visualGenerationBriefForId('HG-VIS-F06-01');
  const cooking = visualGenerationBriefForId('HG-VIS-F07-01');
  const taken = visualGenerationBriefForId('HG-VIS-F07-02');
  const unlock = visualGenerationBriefForId('HG-VIS-F07-03');
  const corridorLock = visualGenerationBriefForId('HG-VIS-F07-05');

  for (const brief of [locked, cooking, taken, unlock, corridorLock]) {
    assert.ok(brief);
    assert.ok(brief.characterPackIds.includes('HG-CHAR-GRETEL-V1'));
    assert.ok(brief.propPackIds.includes('HG-PROP-KEY-SET-V1'), `${brief.visualId} keeps the key set`);
  }
  assert.equal(locked?.targetAssetId, 'kitchen-door-locked');
  assert.equal(locked?.locationPackId, 'HG-LOC-CANDY-INTERIOR-V1');
  assert.equal(cooking?.targetAssetId, 'witch-cooking-keys');
  assert.ok(cooking?.propPackIds.includes('HG-PROP-IRON-CAGE-V1'));
  assert.equal(cooking?.requiredFacts.exitState, taken?.requiredFacts.entryState);
  assert.equal(taken?.targetAssetId, 'wait-and-take-keys');
  assert.equal(taken?.requiredFacts.exitState, unlock?.requiredFacts.entryState);
  assert.ok(unlock?.referenceAssetIds.includes('wait-and-take-keys'));
  assert.equal(corridorLock?.targetAssetId, 'corridor-lock-door');
  assert.equal(corridorLock?.requiredFacts.exitState, 'witch-locked-in-kitchen');

  // 오븐은 닫힌 배경 소품으로만 남는다 - 오븐을 쓰는 장면 규약을 다시 만들지 않는다.
  const oven = hanselGretelVisualReferencePacks.props.OVEN;
  assert.ok(oven.immutableFacts.some((fact) => fact.includes('감금·위협 장소가 아님')));
  for (const brief of hanselGretelVisualGenerationBriefs) {
    assert.doesNotMatch(brief.requiredFacts.action, /oven/, `${brief.visualId} acts on the oven`);
  }
});

test('reference packs preserve the same old-woman identity after the reveal', () => {
  const oldWoman = hanselGretelVisualReferencePacks.characters.OLD_WOMAN;
  const witch = hanselGretelVisualReferencePacks.characters.WITCH;
  // Distinct ids (each a valid standalone DB primary key), but the same physical
  // character: shared reference assets and shared face/body identity facts, differing
  // only in expression (the last fact - warm as the old woman, cold once revealed).
  assert.notEqual(oldWoman.id, witch.id);
  assert.deepEqual(oldWoman.canonicalAssetIds, witch.canonicalAssetIds);
  assert.deepEqual(
    oldWoman.immutableFacts.slice(0, 2),
    witch.immutableFacts.slice(0, 2),
  );
});
