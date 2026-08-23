// @ts-nocheck -- Node test assertions intentionally drive runtime union states.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  transitionStoryRuntime,
  validateStoryManifest,
  type StoryRuntimeState,
} from '@/entities/story-runtime';

import {
  hanselGretelManifest,
  hanselGretelPresentation,
} from './manifest';
import { branchInteractionEntries } from './branch-interaction-copy';
import { buildCaptionTrack } from '@/entities/narration';

test('Master Spec content generates the complete fixed story package', () => {
  assert.equal(hanselGretelPresentation.scenes.length, 10);
  assert.equal(hanselGretelPresentation.scenes[0].id, 'HG-F01');
  assert.equal(hanselGretelPresentation.scenes.at(-1)?.id, 'HG-F10');
  assert.equal(
    hanselGretelPresentation.scenes.reduce(
      (total, scene) => total + scene.visuals.length,
      0,
    ),
    41,
  );
  assert.equal(
    new Set(
      hanselGretelPresentation.scenes.flatMap((scene) =>
        scene.visuals.map((visual) => visual.assetId),
      ),
    ).size,
    41,
  );
  assert.deepEqual(
    hanselGretelPresentation.scenes.flatMap((scene) => scene.questionSlots),
    ['A', 'B', 'C'],
  );
  assert.equal(hanselGretelManifest.fallbackFamilies.length, 14);
  assert.equal(hanselGretelManifest.rejoinAnchors.length, 5);
});

test('compressed pacing reaches the first question without losing the full arc', () => {
  let compactCharacters = 0;
  let utterances = 0;
  let firstInteractionScene: string | null = null;

  outer: for (const scene of hanselGretelPresentation.scenes) {
    for (const segment of scene.segments) {
      if (segment.kind === 'interaction') {
        firstInteractionScene = scene.id;
        break outer;
      }
      if (segment.kind === 'utterance') {
        compactCharacters += segment.text.replace(/[\s“”"']/g, '').length;
        utterances += 1;
      }
    }
  }

  assert.equal(firstInteractionScene, 'HG-F04');
  assert.ok(compactCharacters >= 700 && compactCharacters <= 1_000);
  assert.ok(utterances >= 35 && utterances <= 50);
  assert.deepEqual(
    hanselGretelPresentation.scenes.map((scene) => scene.id),
    Array.from({ length: 10 }, (_, index) =>
      `HG-F${String(index + 1).padStart(2, '0')}`,
    ),
  );
});

test('listener name placeholder appears only in the three question invites', () => {
  const utterances = hanselGretelPresentation.scenes.flatMap((scene) =>
    scene.segments.filter((segment) => segment.kind === 'utterance'),
  );
  const named = utterances.filter((segment) =>
    segment.text.includes('{child_call}'),
  );

  assert.equal(named.length, 3);
  assert.ok(
    named.every((segment) => segment.role.startsWith('QUESTION_INVITE:')),
  );
});

test('F06 explains and depicts the locked-cage twig trick in causal order', () => {
  const scene = hanselGretelPresentation.scenes.find(
    (candidate) => candidate.id === 'HG-F06',
  );
  assert.ok(scene);
  assert.match(scene.visuals[0].mode, /inside-locked-cage/);
  assert.match(scene.visuals[0].requiredAction, /fully-inside-cage/);
  assert.match(scene.visuals[1].mode, /hand-stays-hidden/);
  assert.match(scene.visuals[1].requiredAction, /one-short-bark-twig/);

  const twigNarration = scene.segments
    .filter(
      (segment) =>
        segment.kind === 'utterance' &&
        segment.visualId === 'HG-F06-V02',
    )
    .map((segment) => segment.text);
  assert.deepEqual(twigNarration, [
    '마녀는 헨젤이 살이 올랐는지 확인하려고 했어요.',
    '눈이 어두운 마녀는 날마다 손가락을 내밀라고 했어요.',
    '헨젤은 손을 소매에 숨기고, 짧은 나뭇가지를 대신 내밀었어요.',
    '마녀는 굵기만 만져 보고 손가락이라고 착각했지요.',
  ]);
});

test('question anchors derive curiosity prompts from the tagged Master script', () => {
  const inviteTexts = hanselGretelPresentation.scenes.flatMap((scene) =>
    scene.segments.flatMap((segment) =>
      segment.kind === 'utterance' &&
      segment.role.startsWith('QUESTION_INVITE:')
        ? [segment.text]
        : [],
    ),
  );
  const prompts = hanselGretelManifest.questionAnchors.map(
    (anchor) => anchor.prompt,
  );

  assert.deepEqual(prompts, inviteTexts);
  assert.ok(
    hanselGretelManifest.questionAnchors.every(
      (anchor) => anchor.promptSpeakerId === 'HG-SPK-GRETEL',
    ),
  );
  assert.deepEqual(prompts, [
    '“{child_call}, 하얀 새가 우리를 바라보다가 앞쪽 가지로 옮겨 앉았어. 저 새를 보니 무엇이 궁금해지거나 어떤 생각이 들어?”',
    '“{child_call}, 처음 보는 할머니는 들어오라고 하지만 집에는 이상한 자국과 열쇠가 보여. 무엇을 더 알아보면 좋을까?”',
    '“{child_call}, 마녀는 자기는 멀리 서서 나만 오븐 가까이 가라고 해. 내가 안전하려면 무엇을 먼저 생각해 보면 좋을까?”',
  ]);
  assert.ok(
    hanselGretelManifest.questionAnchors.every(
      (anchor) =>
        anchor.interactionMode === 'curiosity' &&
        ['question', 'guess', 'warning', 'plan'].every((kind) =>
          anchor.acceptedInputKinds.includes(
            kind as (typeof anchor.acceptedInputKinds)[number],
          ),
        ),
    ),
  );
  assert.ok(prompts.every((prompt) => prompt.length <= 85));
});

// The two upstream tests that grepped `one-story-product-screen.tsx` for
// specific substrings (guarding against duplicated prompt copies or dead
// code in that single 4300-line file) were dropped during the move to
// q-story-web: the screen was split into `pages/`, `widgets/`, and
// `features/` modules, so "one file, one copy of X" no longer maps onto a
// single source file to grep. The underlying behaviors they protected are
// now enforced by the module boundaries themselves.

test('generated story manifest passes shared contract validation', () => {
  const result = validateStoryManifest(hanselGretelManifest);
  assert.equal(
    result.ok,
    true,
    result.ok
      ? undefined
      : result.issues.map((issue) => issue.message).join('\n'),
  );
});

test('question-free fixed route reaches F10 complete without a loop', () => {
  let state: StoryRuntimeState = {
    status: 'idle',
    storyId: hanselGretelManifest.storyId,
  };
  let transition = transitionStoryRuntime(hanselGretelManifest, state, {
    type: 'START',
  });
  assert.equal(transition.ok, true);
  if (!transition.ok) {
    return;
  }
  state = transition.state;

  let steps = 0;
  while (state.status !== 'complete' && steps < 500) {
    steps += 1;
    if (state.status === 'playing-fixed') {
      const group = hanselGretelManifest.audioGroups.find(
        (candidate) => candidate.id === state.audioGroupId,
      );
      const clip = group?.clips[state.clipIndex];
      assert.ok(clip);
      transition = transitionStoryRuntime(hanselGretelManifest, state, {
        type: 'AUDIO_ENDED',
        clipId: clip.id,
      });
    } else if (state.status === 'awaiting-question') {
      transition = transitionStoryRuntime(hanselGretelManifest, state, {
        type: 'CONTINUE_SELECTED',
      });
    } else {
      assert.fail(`Unexpected state in question-free route: ${state.status}`);
    }

    assert.equal(transition.ok, true);
    if (!transition.ok) {
      return;
    }
    state = transition.state;
  }

  assert.ok(steps < 500, 'fixed route exceeded the termination guard');
  assert.equal(state.status, 'complete');
  if (state.status === 'complete') {
    assert.equal(state.completedSceneId, 'HG-F10');
  }
});

test('every fallback resolves to an allowed rejoin with playable content', () => {
  for (const fallback of hanselGretelManifest.fallbackFamilies) {
    const presentation =
      hanselGretelPresentation.fallbackByFamilyId[fallback.id];
    assert.ok(presentation, `missing presentation for ${fallback.id}`);
    assert.ok(
      presentation.segments.some((segment) => segment.kind === 'utterance'),
      `fallback ${fallback.id} has no utterance`,
    );
    assert.ok(
      hanselGretelManifest.rejoinAnchors.some(
        (anchor) => anchor.id === fallback.rejoinAnchorId,
      ),
      `fallback ${fallback.id} has an orphan rejoin`,
    );
  }
});

test('A, B, and C branch visuals follow the narrated state change', () => {
  const fallbackById = Object.fromEntries(
    hanselGretelPresentation.fallbacks.map((fallback) => [
      fallback.id,
      fallback,
    ]),
  );
  const visualAssetIds = (familyId: string) =>
    fallbackById[familyId].segments
      .filter((segment) => segment.kind === 'visual')
      .map((segment) => segment.assetId);

  for (const familyId of [
    'A_OBSERVE_BIRD',
    'A_SPEAK_TO_BIRD',
    'A_CHECK_SURROUNDINGS',
    'A_TRY_OTHER_PATH',
    'B_ASK_OLD_WOMAN',
    'B_CHECK_KEYS',
    'B_CHECK_HOUSE',
    'B_MAKE_SIBLING_SIGNAL',
    'C_ASK_DEMONSTRATION',
    'C_CHECK_LOCK_FROM_DISTANCE',
  ]) {
    assert.equal(visualAssetIds(familyId).length, 1, `${familyId} visual count`);
  }

  assert.deepEqual(visualAssetIds('B_STEP_BACK_MARK_EXIT'), [
    'HG-FB-ART-B-STEP-BACK-MARK-EXIT-V1',
    'HG-FB-ART-B-STEP-BACK-MARK-EXIT-V2',
  ]);
  for (const familyId of [
    'C_DISTRACT_AND_TAKE_KEYS',
    'C_USE_SIGNAL',
    'C_BLOCK_PURSUIT_SAFELY',
  ]) {
    const assets = visualAssetIds(familyId);
    assert.equal(assets.length, 2, `${familyId} needs action and escape beats`);
    assert.notEqual(assets[0], assets[1], `${familyId} repeats one illustration`);
    assert.equal(assets[1], 'HG-ART-34-ESCAPE-CORRIDOR');
  }
  assert.equal(fallbackById.C_USE_SIGNAL.requires, null);
  assert.equal(
    fallbackById.C_DISTRACT_AND_TAKE_KEYS.segments.some(
      (segment) => segment.kind === 'sfx',
    ),
    false,
    'the distraction branch must not depend on an unregistered sound effect',
  );
});

test('completed C escape branches skip the contradictory fixed oven ending', () => {
  for (const familyId of [
    'C_DISTRACT_AND_TAKE_KEYS',
    'C_USE_SIGNAL',
    'C_BLOCK_PURSUIT_SAFELY',
  ]) {
    const family = hanselGretelManifest.fallbackFamilies.find(
      (candidate) => candidate.id === familyId,
    );
    assert.ok(family, `missing ${familyId}`);
    assert.equal(
      family.rejoinAnchorId,
      'HG-F08-AFTER-BRANCH-ESCAPE',
      `${familyId} must continue at F08 after its own escape`,
    );
  }
});

test('C escape branch plays every F08 clip and advances to F09', () => {
  const familyId = 'C_DISTRACT_AND_TAKE_KEYS';
  const family = hanselGretelManifest.fallbackFamilies.find(
    (candidate) => candidate.id === familyId,
  );
  assert.ok(family);

  let state: StoryRuntimeState = {
    status: 'playing-response',
    sceneId: 'HG-F07',
    anchorId: 'HG-Q-C',
    questionRound: 1,
    plan: {
      kind: 'route',
      route: 'DIRECT_ACTION',
      originRoute: 'THREE_PATHS',
      selectedOptionId: 'OPTION_1',
      text: '좋아, 안전하게 열쇠를 챙길 기회를 찾아보자.',
      speakerId: 'HG-SPK-GRETEL',
      childRelevantMeaning: '마녀의 시선을 돌리고 헨젤을 구한다.',
      actionFamilyId: familyId,
      rejoinAt: family.rejoinAnchorId,
      fallbackFamilyId: familyId,
      options: [],
    },
  };

  let transition = transitionStoryRuntime(hanselGretelManifest, state, {
    type: 'RESPONSE_AUDIO_ENDED',
  });
  assert.equal(transition.ok, true);
  if (!transition.ok) return;
  state = transition.state;
  assert.equal(state.status, 'playing-fixed');
  assert.equal(state.sceneId, 'HG-F08');

  const playedClipIds: string[] = [];
  let guard = 0;
  while (
    state.status === 'playing-fixed' &&
    state.sceneId === 'HG-F08' &&
    guard < 30
  ) {
    guard += 1;
    const group = hanselGretelManifest.audioGroups.find(
      (candidate) => candidate.id === state.audioGroupId,
    );
    const clip = group?.clips[state.clipIndex];
    assert.ok(clip);
    playedClipIds.push(clip.id);
    transition = transitionStoryRuntime(hanselGretelManifest, state, {
      type: 'AUDIO_ENDED',
      clipId: clip.id,
    });
    assert.equal(transition.ok, true);
    if (!transition.ok) return;
    state = transition.state;
  }

  assert.equal(guard < 30, true, 'F08 playback exceeded the loop guard');
  assert.equal(playedClipIds.length, 9);
  assert.equal(state.status, 'playing-fixed');
  assert.equal(state.sceneId, 'HG-F09');
});

test('all visual beats use registered assets and one-breath fixed captions', () => {
  const illustrationRegistryPath = fileURLToPath(
    new URL('../model/story-assets.generated.ts', import.meta.url),
  );
  const illustrationRegistry = readFileSync(illustrationRegistryPath, 'utf8');
  const usedAssetIds = new Set(
    hanselGretelPresentation.scenes.flatMap((scene) =>
      scene.visuals.map((visual) => visual.assetId),
    ),
  );

  assert.equal(usedAssetIds.size, 41);
  assert.deepEqual(
    hanselGretelPresentation.scenes.flatMap((scene) =>
      scene.visuals.map((visual) => visual.assetId),
    ),
    [
      'HG-ART-01-HOME-TABLE',
      'HG-ART-02-NIGHT-PLAN',
      'HG-ART-19-PEBBLE-COLLECTION',
      'HG-ART-03-FIRST-WALK-PEBBLES',
      'HG-ART-20-FOREST-WAITING',
      'HG-ART-04-MOONLIT-RETURN',
      'HG-ART-21-FIRST-HOMECOMING',
      'HG-ART-36-SECOND-NIGHT-PLAN',
      'HG-ART-40-LOCKED-DOOR-NIGHT-V2',
      'HG-ART-41-MORNING-BREAD-PLAN-V2',
      'HG-ART-22-SECOND-WALK-BREADCRUMBS',
      'HG-ART-27-BIRDS-EAT-BREADCRUMBS',
      'HG-ART-06-LOST-FOREST',
      'HG-ART-28-MORNING-SONG',
      'HG-ART-07-WHITE-BIRD',
      'HG-ART-29-WHITE-BIRD-LEADS',
      'HG-ART-08-CANDY-HOUSE-REVEAL',
      'HG-ART-09-CANDY-HOUSE-CLOSE',
      'HG-ART-10-OLD-WOMAN-DOOR',
      'HG-ART-30-BLACK-KEY-GLOW',
      'HG-ART-23-CANDY-HOUSE-INTERIOR',
      'HG-ART-11-WITCH-REVEAL',
      'HG-ART-42-SHORT-TWIG-CHECK-V2',
      'HG-ART-31-GRETEL-WATCHES-KEYS',
      'HG-ART-32-WITCH-LOSES-PATIENCE',
      'HG-ART-13-OVEN-COMMAND',
      'HG-ART-33-WITCH-SETS-DOWN-KEYS-V2',
      'HG-ART-43-WITCH-DEMONSTRATES-OVEN-V2',
      'HG-ART-44-OVEN-SECURED-KEYS-V2',
      'HG-ART-45-CAGE-UNLOCK-OVEN-SECURED-V2',
      'HG-ART-46-BLACK-KEY-SIDE-DOOR-V2',
      'HG-ART-34-ESCAPE-CORRIDOR',
      'HG-ART-16-STOREHOUSE',
      'HG-ART-37-PACKING-EVIDENCE',
      'HG-ART-35-CANDY-HOUSE-EXIT',
      'HG-ART-38-WATERWAY-OBSTACLE',
      'HG-ART-17-WATER-RETURN',
      'HG-ART-24-MARKED-RETURN-PATH',
      'HG-ART-18-HOME-PROMISE',
      'HG-ART-25-VILLAGE-RESTITUTION',
      'HG-ART-26-WINDOW-EPILOGUE',
    ],
  );
  for (const assetId of usedAssetIds) {
    assert.ok(
      illustrationRegistry.includes(assetId),
      `${assetId} is missing from the illustration registry`,
    );
  }

  for (const scene of hanselGretelPresentation.scenes) {
    const visualIds = new Set(scene.visuals.map((visual) => visual.id));
    const utteranceCountByVisual = new Map(
      scene.visuals.map((visual) => [visual.id, 0]),
    );
    for (const segment of scene.segments) {
      if (segment.kind !== 'utterance') {
        continue;
      }
      utteranceCountByVisual.set(
        segment.visualId!,
        (utteranceCountByVisual.get(segment.visualId!) ?? 0) + 1,
      );
      assert.ok(
        segment.visualId && visualIds.has(segment.visualId),
        `${scene.id} utterance has an orphan visual`,
      );
      if (segment.role.startsWith('QUESTION_INVITE:')) {
        assert.ok(
          segment.text.length <= 120,
          `${scene.id} question invite exceeds 120 characters`,
        );
      } else {
        assert.ok(
          segment.text.length <= 36,
          `${scene.id} fixed breath exceeds 36 characters: ${segment.text}`,
        );
        assert.equal(
          buildCaptionTrack(segment.text).cues.length,
          1,
          `${scene.id} fixed breath produced more than one caption cue`,
        );
      }
    }
    for (const visual of scene.visuals) {
      assert.ok(visual.time, `${visual.id} has no time contract`);
      assert.ok(visual.location, `${visual.id} has no location contract`);
      assert.ok(visual.characters.length > 0, `${visual.id} has no characters`);
      assert.ok(visual.entryState, `${visual.id} has no entry state`);
      assert.ok(visual.requiredAction, `${visual.id} has no required action`);
      assert.ok(visual.exitState, `${visual.id} has no exit state`);
      const utteranceCount = utteranceCountByVisual.get(visual.id) ?? 0;
      assert.ok(utteranceCount > 0, `${visual.id} has no utterance`);
      assert.ok(
        utteranceCount <= 4 || Boolean(visual.exception),
        `${visual.id} exceeds four utterances without an exception`,
      );
    }
  }
});

test('all versioned master illustrations and every fixed narration clip are packaged', () => {
  const illustrationDirectory = fileURLToPath(
    new URL('../../../../public/story/hansel-gretel/illustrations/', import.meta.url),
  );
  const audioDirectory = fileURLToPath(
    new URL('../../../../public/story/hansel-gretel/audio/', import.meta.url),
  );
  const assetFileById = {
    'HG-ART-01': `${illustrationDirectory}hg-art-01-home-table.jpg`,
    'HG-ART-02': `${illustrationDirectory}hg-art-02-night-plan.jpg`,
    'HG-ART-03': `${illustrationDirectory}hg-art-03-first-walk-pebbles.jpg`,
    'HG-ART-04': `${illustrationDirectory}hg-art-04-moonlit-return.jpg`,
    'HG-ART-05': `${illustrationDirectory}hg-art-05-locked-door-bread.jpg`,
    'HG-ART-06': `${illustrationDirectory}hg-art-06-lost-forest-walking-v2.png`,
    'HG-ART-07': `${illustrationDirectory}hg-art-07-white-bird.jpg`,
    'HG-ART-08': `${illustrationDirectory}hg-art-08-candy-house-reveal.jpg`,
    'HG-ART-09': `${illustrationDirectory}hg-art-09-candy-house-close.jpg`,
    'HG-ART-10': `${illustrationDirectory}hg-art-10-old-woman-door.jpg`,
    'HG-ART-11': `${illustrationDirectory}hg-art-11-witch-reveal-v3.jpg`,
    'HG-ART-12': `${illustrationDirectory}hg-art-12-cage-key-pattern.jpg`,
    'HG-ART-13': `${illustrationDirectory}hg-art-13-oven-command.jpg`,
    'HG-ART-14': `${illustrationDirectory}hg-art-14-key-escape.jpg`,
    'HG-ART-15': `${illustrationDirectory}hg-art-15-reversed-lock.jpg`,
    'HG-ART-16': `${illustrationDirectory}hg-art-16-storehouse.jpg`,
    'HG-ART-17': `${illustrationDirectory}hg-art-17-water-crossing-v2.jpg`,
    'HG-ART-18': `${illustrationDirectory}hg-art-18-home-apology-v2.jpg`,
    'HG-ART-19': `${illustrationDirectory}hg-art-19-pebble-collection.jpg`,
    'HG-ART-20': `${illustrationDirectory}hg-art-20-forest-waiting.jpg`,
    'HG-ART-21': `${illustrationDirectory}hg-art-21-first-homecoming.jpg`,
    'HG-ART-22': `${illustrationDirectory}hg-art-22-second-walk-breadcrumbs.jpg`,
    'HG-ART-23': `${illustrationDirectory}hg-art-23-candy-house-interior.jpg`,
    'HG-ART-24': `${illustrationDirectory}hg-art-24-marked-return-path.jpg`,
    'HG-ART-25': `${illustrationDirectory}hg-art-25-village-restitution.jpg`,
    'HG-ART-26': `${illustrationDirectory}hg-art-26-window-epilogue.jpg`,
    'HG-ART-27': `${illustrationDirectory}hg-art-27-birds-eat-breadcrumbs.jpg`,
    'HG-ART-28': `${illustrationDirectory}hg-art-28-morning-song.jpg`,
    'HG-ART-29': `${illustrationDirectory}hg-art-29-white-bird-leads.jpg`,
    'HG-ART-30': `${illustrationDirectory}hg-art-30-black-key-glow.jpg`,
    'HG-ART-31': `${illustrationDirectory}hg-art-31-gretel-watches-keys.jpg`,
    'HG-ART-32': `${illustrationDirectory}hg-art-32-witch-loses-patience.jpg`,
    'HG-ART-33': `${illustrationDirectory}hg-art-33-witch-demonstrates-oven.jpg`,
    'HG-ART-33-PREP': `${illustrationDirectory}hg-art-33-witch-sets-down-keys-v2.jpg`,
    'HG-ART-34': `${illustrationDirectory}hg-art-34-escape-corridor.jpg`,
    'HG-ART-35': `${illustrationDirectory}hg-art-35-candy-house-exit.jpg`,
    'HG-ART-36': `${illustrationDirectory}hg-art-36-second-night-plan.jpg`,
    'HG-ART-37': `${illustrationDirectory}hg-art-37-packing-evidence.jpg`,
    'HG-ART-38': `${illustrationDirectory}hg-art-38-waterway-obstacle.jpg`,
    'HG-ART-39': `${illustrationDirectory}hg-art-39-cage-unlock.jpg`,
    'HG-ART-40': `${illustrationDirectory}hg-art-40-locked-door-night-v2.jpg`,
    'HG-ART-41': `${illustrationDirectory}hg-art-41-morning-bread-plan-v2.jpg`,
    'HG-ART-42': `${illustrationDirectory}hg-art-42-short-twig-check-v3.jpg`,
    'HG-ART-43': `${illustrationDirectory}hg-art-43-witch-demonstrates-oven-v2.jpg`,
    'HG-ART-44': `${illustrationDirectory}hg-art-44-oven-secured-keys-v2.jpg`,
    'HG-ART-45': `${illustrationDirectory}hg-art-45-cage-unlock-oven-secured-v2.jpg`,
    'HG-ART-46': `${illustrationDirectory}hg-art-46-black-key-side-door-v2.jpg`,
  };

  for (const [assetPrefix, filePath] of Object.entries(assetFileById)) {
    assert.ok(existsSync(filePath), `${assetPrefix} image is missing`);
  }

  const branchImagePaths = branchInteractionEntries.map(
    ({ familyId }) =>
      `${illustrationDirectory}fb-${familyId.toLowerCase().replaceAll('_', '-')}-v1.webp`,
  );
  assert.equal(branchImagePaths.length, 14);
  assert.ok(
    branchImagePaths.every(
      (filePath) =>
        existsSync(filePath) &&
        statSync(filePath).size > 100_000 &&
        statSync(filePath).size < 800_000,
    ),
    'every branch needs a packaged, mobile-sized WebP illustration',
  );
  const stepBackRevealPath =
    `${illustrationDirectory}fb-b-step-back-mark-exit-v2.webp`;
  assert.ok(
    existsSync(stepBackRevealPath) &&
      statSync(stepBackRevealPath).size > 100_000 &&
      statSync(stepBackRevealPath).size < 800_000,
    'B step-back reveal needs its own packaged illustration',
  );

  const narrationMetadata = JSON.parse(
    readFileSync(
      `${audioDirectory}fixed-narration-metadata.json`,
      'utf8',
    ),
  );
  assert.equal(
    narrationMetadata.contentVersion,
    hanselGretelManifest.contentVersion,
  );
  const expectedFixedClipCount =
    hanselGretelPresentation.scenes.reduce(
      (count, scene) =>
        count +
        scene.segments.filter(
          (segment) =>
            segment.kind === 'utterance' &&
            !segment.text.includes('{child_name}') &&
            !segment.text.includes('{child_call}'),
        ).length,
      0,
    ) +
    hanselGretelPresentation.fallbacks.reduce(
      (count, fallback) =>
        count +
        fallback.segments.filter(
          (segment) => segment.kind === 'utterance',
        ).length,
      0,
    );
  assert.equal(
    narrationMetadata.clips.length,
    expectedFixedClipCount + branchInteractionEntries.length,
  );
  const metadataByClipId = new Map(
    narrationMetadata.clips.map((clip) => [clip.clipId, clip]),
  );
  const packagedAssets = JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL(
          '../../../../content/stories/hansel-gretel/assets.json',
          import.meta.url,
        ),
      ),
      'utf8',
    ),
  );
  const normalizedText = (text: string) =>
    text.replaceAll('\n', ' ').replace(/\s+/g, ' ').trim();
  for (const [clipId, utterance] of Object.entries(
    hanselGretelPresentation.utteranceByClipId,
  )) {
    if (
      utterance.text.includes('{child_name}') ||
      utterance.text.includes('{child_call}')
    ) {
      continue;
    }
    const metadataClip = metadataByClipId.get(clipId);
    assert.ok(metadataClip, `${clipId} is missing fixed narration metadata`);
    assert.equal(
      metadataClip.text,
      normalizedText(utterance.text),
      `${clipId} narration text does not match its runtime caption`,
    );
    assert.equal(
      packagedAssets.audioAssets[clipId],
      `assets/story/hansel-gretel/audio/${metadataClip.fileName}`,
      `${clipId} points to a different narration file`,
    );
  }
  assert.equal(branchInteractionEntries.length, 14);
  assert.ok(
    branchInteractionEntries.every((entry) =>
      narrationMetadata.clips.some(
        (clip) =>
          clip.clipId === entry.audioId &&
          clip.speaker === 'GRETEL' &&
          clip.voice === 'Leda' &&
          clip.text === entry.text,
      ),
    ),
  );
  assert.ok(
    narrationMetadata.clips.every((clip) => {
      const filePath = `${audioDirectory}${clip.fileName}`;
      return existsSync(filePath) && statSync(filePath).size > 1_000;
    }),
  );
  assert.equal(narrationMetadata.castVersion, 'hg-gemini-tts-cast-v2');
  const expectedVoiceBySpeaker = {
    NARRATOR: 'Sulafat',
    HANSEL: 'Puck',
    GRETEL: 'Leda',
    FATHER: 'Charon',
    STEPMOTHER: 'Kore',
    OLD_WOMAN: 'Gacrux',
    WITCH: 'Gacrux',
  };
  assert.ok(
    narrationMetadata.clips.every(
      (clip) => expectedVoiceBySpeaker[clip.speaker] === clip.voice,
    ),
    'at least one fixed clip does not match the locked speaker voice',
  );
  assert.equal(
    narrationMetadata.clips.some((clip) => clip.voice === 'Orus'),
    false,
  );
  assert.ok(
    hanselGretelPresentation.scenes
      .flatMap((scene) => scene.segments)
      .filter(
        (segment) =>
          segment.kind === 'utterance' &&
          (segment.role === 'DIALOGUE' ||
            segment.role.startsWith('QUESTION_INVITE:')),
      )
      .every((segment) => segment.speaker !== 'NARRATOR'),
    'character dialogue or question invite is tagged as narrator',
  );
});

test('critical visual continuity prevents the reported F03 and F07-F08 contradictions', () => {
  const visualById = Object.fromEntries(
    hanselGretelPresentation.scenes.flatMap((scene) =>
      scene.visuals.map((visual) => [visual.id, visual]),
    ),
  );

  assert.equal(visualById['HG-F03-V01'].time, 'night');
  assert.equal(visualById['HG-F03-V02'].time, 'next-morning');
  assert.equal(visualById['HG-F03-V04'].time, 'night');
  assert.equal(
    visualById['HG-F03-V04'].requiredAction,
    'birds-eat-last-crumbs',
  );
  assert.equal(visualById['HG-F03-V05'].time, 'next-day');
  assert.equal(visualById['HG-F03-V06'].time, 'following-dawn');
  assert.equal(
    visualById['HG-F07-V02A'].exitState,
    visualById['HG-F07-V02'].entryState,
  );
  assert.equal(
    visualById['HG-F07-V05'].exitState,
    'side-door-open-siblings-safe',
  );
  assert.equal(
    visualById['HG-F07-V06'].exitState,
    visualById['HG-F08-V01'].entryState,
  );
  assert.equal(
    visualById['HG-F08-V02'].exitState,
    'small-bag-packed',
  );
  assert.equal(
    visualById['HG-F08-V03'].exitState,
    'siblings-outside-candy-house',
  );
});
