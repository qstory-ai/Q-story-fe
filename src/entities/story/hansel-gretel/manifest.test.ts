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
        segment.visualId === 'HG-VIS-F06-02',
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

// `one-story-product-screen.tsx`에서 특정 부분 문자열을 grep해서 (그 4300줄짜리 단일
// 파일 안에 프롬프트 카피가 중복되거나 죽은 코드가 있는지 방지하던) 업스트림 테스트 두
// 개는 q-story-web으로 옮기면서 제거했다: 그 화면이 `pages/`, `widgets/`,
// `features/` 모듈로 쪼개지면서 "파일 하나, X의 사본 하나"라는 전제가 더 이상 grep할
// 단일 소스 파일에 대응되지 않기 때문이다. 그 테스트들이 지켜주던 동작들은 이제 모듈
// 경계 자체가 강제한다.

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
    'b-step-back-mark-exit-01',
    'b-step-back-mark-exit-02',
  ]);
  for (const familyId of [
    'C_DISTRACT_AND_TAKE_KEYS',
    'C_USE_SIGNAL',
    'C_BLOCK_PURSUIT_SAFELY',
  ]) {
    const assets = visualAssetIds(familyId);
    assert.equal(assets.length, 2, `${familyId} needs action and escape beats`);
    assert.notEqual(assets[0], assets[1], `${familyId} repeats one illustration`);
    assert.equal(assets[1], 'escape-corridor');
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
      'home-table',
      'night-plan',
      'pebble-collection',
      'first-walk-pebbles',
      'forest-waiting',
      'moonlit-return',
      'first-homecoming',
      'second-night-plan',
      'locked-door-night',
      'morning-bread-plan',
      'second-walk-breadcrumbs',
      'birds-eat-breadcrumbs',
      'lost-forest',
      'morning-song',
      'white-bird',
      'white-bird-leads',
      'candy-house-reveal',
      'candy-house-close',
      'old-woman-door',
      'black-key-glow',
      'candy-house-interior',
      'witch-reveal',
      'short-twig-check',
      'gretel-watches-keys',
      'witch-loses-patience',
      'oven-command',
      'witch-sets-down-keys',
      'witch-demonstrates-oven',
      'oven-secured-keys',
      'cage-unlock-oven-secured',
      'black-key-side-door',
      'escape-corridor',
      'storehouse',
      'packing-evidence',
      'candy-house-exit',
      'waterway-obstacle',
      'water-return',
      'marked-return-path',
      'home-promise',
      'village-restitution',
      'window-epilogue',
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
  const audioDirectory = fileURLToPath(
    new URL('../../../../public/story/hansel-gretel/audio/', import.meta.url),
  );
  // Driven by assets.json instead of a second, hand-written copy of it. The previous version
  // listed all 47 illustration paths by number, so every added, renamed, or retired asset had to
  // be mirrored here by hand - and it went on asserting six files that nothing shows any more.
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
  const appRoot = fileURLToPath(new URL('../../../../', import.meta.url));
  const onDisk = (relativePath: string) =>
    `${appRoot}${relativePath.replace(/^assets\//, 'public/')}`;

  for (const asset of packagedAssets.assets) {
    assert.ok(
      existsSync(onDisk(`${packagedAssets.root}${asset.file}`)),
      `${asset.slug} file is missing`,
    );
  }

  // Branch art is fetched mid-question on a phone, so it stays inside the mobile WebP size band.
  const branchArt = packagedAssets.assets.filter(
    (asset) => asset.category === 'BRANCH_ART' && asset.panel === 1,
  );
  assert.equal(branchArt.length, 14);
  for (const asset of branchArt) {
    const size = statSync(onDisk(`${packagedAssets.root}${asset.file}`)).size;
    assert.ok(
      size > 100_000 && size < 800_000,
      `${asset.slug} is outside the mobile branch-illustration size band`,
    );
  }
  const audioFileBySlug = new Map(
    packagedAssets.assets
      .filter((asset) => asset.category === 'NARRATION' || asset.category === 'BRIDGE')
      .map((asset) => [asset.slug, `${packagedAssets.root}${asset.file}`]),
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
      audioFileBySlug.get(clipId),
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

  assert.equal(visualById['HG-VIS-F03-01'].time, 'night');
  assert.equal(visualById['HG-VIS-F03-02'].time, 'next-morning');
  assert.equal(visualById['HG-VIS-F03-04'].time, 'night');
  assert.equal(
    visualById['HG-VIS-F03-04'].requiredAction,
    'birds-eat-last-crumbs',
  );
  assert.equal(visualById['HG-VIS-F03-05'].time, 'next-day');
  assert.equal(visualById['HG-VIS-F03-06'].time, 'following-dawn');
  assert.equal(
    visualById['HG-VIS-F07-02A'].exitState,
    visualById['HG-VIS-F07-02'].entryState,
  );
  assert.equal(
    visualById['HG-VIS-F07-05'].exitState,
    'side-door-open-siblings-safe',
  );
  assert.equal(
    visualById['HG-VIS-F07-06'].exitState,
    visualById['HG-VIS-F08-01'].entryState,
  );
  assert.equal(
    visualById['HG-VIS-F08-02'].exitState,
    'small-bag-packed',
  );
  assert.equal(
    visualById['HG-VIS-F08-03'].exitState,
    'siblings-outside-candy-house',
  );
});
