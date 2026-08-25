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
  assert.equal(hanselGretelVisualGenerationBriefs.length, 41);
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
    41,
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

test('F07 escape images preserve the oven-first sequence and shared props', () => {
  const command = visualGenerationBriefForId('HG-F07-V01');
  const preparation = visualGenerationBriefForId('HG-F07-V02A');
  const demonstration = visualGenerationBriefForId('HG-F07-V02');
  const securedOven = visualGenerationBriefForId('HG-F07-V03');
  const unlock = visualGenerationBriefForId('HG-F07-V04');

  for (const brief of [
    command,
    preparation,
    demonstration,
    securedOven,
    unlock,
  ]) {
    assert.ok(brief);
    assert.ok(brief.characterPackIds.includes('HG-CHAR-GRETEL-V1'));
  }
  assert.ok(command?.propPackIds.includes('HG-PROP-IRON-CAGE-V1'));
  assert.ok(command?.propPackIds.includes('HG-PROP-OVEN-V1'));
  assert.equal(
    preparation?.targetAssetId,
    'HG-ART-33-WITCH-SETS-DOWN-KEYS-V2',
  );
  assert.equal(preparation?.requiredFacts.exitState, 'keys-left-on-worktable');
  assert.equal(demonstration?.requiredFacts.entryState, 'keys-left-on-worktable');
  assert.ok(
    demonstration?.characterPackIds.includes(
      'HG-CHAR-OLD-WOMAN-WITCH-V1',
    ),
  );
  assert.ok(demonstration?.propPackIds.includes('HG-PROP-OVEN-V1'));
  assert.ok(securedOven?.propPackIds.includes('HG-PROP-KEY-SET-V1'));
  assert.ok(securedOven?.propPackIds.includes('HG-PROP-OVEN-V1'));
  assert.ok(unlock?.propPackIds.includes('HG-PROP-KEY-SET-V1'));
  assert.ok(unlock?.propPackIds.includes('HG-PROP-IRON-CAGE-V1'));
  assert.ok(
    unlock?.referenceAssetIds.includes('HG-ART-42-SHORT-TWIG-CHECK-V2'),
  );
  assert.ok(
    unlock?.referenceAssetIds.includes(
      'HG-ART-44-OVEN-SECURED-KEYS-V2',
    ),
  );
  assert.ok(
    unlock?.referenceAssetIds.includes(
      'HG-ART-45-CAGE-UNLOCK-OVEN-SECURED-V2',
    ),
  );
});

test('reference packs preserve the same old-woman identity after the reveal', () => {
  const oldWoman = hanselGretelVisualReferencePacks.characters.OLD_WOMAN;
  const witch = hanselGretelVisualReferencePacks.characters.WITCH;
  assert.equal(oldWoman.id, witch.id);
  assert.deepEqual(oldWoman.canonicalAssetIds, witch.canonicalAssetIds);
});
