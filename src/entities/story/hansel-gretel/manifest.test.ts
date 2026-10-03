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
import { buildCaptionTrack } from '@/entities/narration';
import packageData from './story-package.generated.json';

// 분기 진입 브릿지 대사는 route-context.yaml의 acknowledgementText/bridgeAudioId가 단일 원본이다.
const branchInteractionEntries = Object.values(packageData.routeContext.anchors).flatMap(
  (anchor) =>
    anchor.actionFamilies.map((family) => ({
      audioId: family.bridgeAudioId,
      text: family.acknowledgementText,
    })),
);

const SCENE_ASSETS = [
  'home-table',
  'night-plan',
  'pebble-collection',
  'first-walk-pebbles',
  'forest-waiting',
  'forest-night-waiting',
  'moonlit-return',
  'first-homecoming',
  'second-night-plan',
  'locked-door-night',
  'morning-bread-plan',
  'second-walk-breadcrumbs',
  'deep-forest-waiting',
  'birds-eat-breadcrumbs',
  'lost-forest',
  'morning-song',
  'white-bird',
  'white-bird-leads',
  'candy-house-reveal',
  'candy-house-close',
  'old-woman-door',
  'candy-house-interior',
  'kitchen-door-locked',
  'witch-reveal',
  'gretel-watches-keys',
  'gretel-whispers-keys',
  'witch-cooking-keys',
  'wait-and-take-keys',
  'cage-unlock-oven-secured',
  'black-key-side-door',
  'corridor-lock-door',
  'escape-corridor',
  'storehouse',
  'packing-food',
  'candy-house-exit',
  'waterway-obstacle',
  'water-return',
  'marked-return-path',
  'home-promise',
  'window-epilogue',
];

function utteranceTexts(sceneId: string) {
  const scene = hanselGretelPresentation.scenes.find(
    (candidate) => candidate.id === sceneId,
  );
  assert.ok(scene, `missing ${sceneId}`);
  return scene.segments
    .filter((segment) => segment.kind === 'utterance')
    .map((segment) => segment.text);
}

test('Q-30 final script generates the complete fixed story package', () => {
  assert.equal(hanselGretelPresentation.scenes.length, 10);
  assert.equal(hanselGretelPresentation.scenes[0].id, 'HG-F01');
  assert.equal(hanselGretelPresentation.scenes.at(-1)?.id, 'HG-F10');
  assert.equal(
    hanselGretelPresentation.scenes.reduce(
      (total, scene) => total + scene.visuals.length,
      0,
    ),
    SCENE_ASSETS.length,
  );
  assert.deepEqual(
    hanselGretelPresentation.scenes.flatMap((scene) => scene.questionSlots),
    ['A', 'B', 'C'],
  );
  // A·C에는 준비한 행동 대본이 두 개씩 있고, B는 대화만 한다.
  assert.deepEqual(
    hanselGretelManifest.fallbackFamilies.map((family) => family.id),
    ['A_OBSERVE_BIRD', 'A_SPEAK_TO_BIRD', 'C_WAIT_FOR_WITCH_TURN', 'C_DISTRACT_AND_TAKE_KEYS'],
  );
  assert.deepEqual(
    hanselGretelManifest.rejoinAnchors.map((anchor) => anchor.id),
    ['HG-F04-CANDY-HOUSE-REVEAL', 'HG-F07-KEYS-TAKEN'],
  );
  assert.ok(
    hanselGretelManifest.questionAnchors.every(
      (anchor) => anchor.defaultFallbackFamilyId === null,
    ),
  );
});

test('first question arrives in F04 without stretching the opening', () => {
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
  // 최종 원고는 누가 제안·동의했는지, 왜 다시 돌을 찾는지처럼 사건의 이유를 살려 이전보다 길다 -
  // 그 이상 늘어나지 않게 상한을 지킨다.
  assert.ok(compactCharacters >= 700 && compactCharacters <= 1_100, `${compactCharacters} characters`);
  assert.ok(utterances >= 35 && utterances <= 75, `${utterances} utterances`);
});

test('question invites are fixed lines without the listener name', () => {
  const utterances = hanselGretelPresentation.scenes.flatMap((scene) =>
    scene.segments.filter((segment) => segment.kind === 'utterance'),
  );
  // 최종 원고의 초대는 이름 없이 그레텔이 바로 묻는다 - 그래서 초대까지 미리 녹음할 수 있다.
  assert.equal(
    utterances.filter((segment) => /\{child_(call|name)\}/.test(segment.text)).length,
    0,
  );
});

test('the story keeps the causes the final script added and drops the retired events', () => {
  const all = hanselGretelPresentation.scenes
    .flatMap((scene) => utteranceTexts(scene.id))
    .join(' ');
  // 제안한 사람과 동의한 사람을 나누고, 두 번째 계획을 들은 뒤에 돌을 떠올린다.
  assert.match(all, /새어머니가 아이들을 숲에 두고 오자고 했어요/);
  assert.match(all, /끝내 고개를 끄덕였어요/);
  assert.ok(
    all.indexOf('이 대화를 들었어요') < all.indexOf('지난번의 하얀 돌을 떠올렸어요'),
  );
  for (const retired of [/나뭇가지를 대신 내밀/, /살이 올랐는지/, /오븐/, /설탕 무늬/, /장부/, /깃털/, /도끼/]) {
    assert.doesNotMatch(all, retired);
  }
});

test('F06 locks the kitchen door before caging Hansel and shows which key opens which door', () => {
  const scene = hanselGretelPresentation.scenes.find(
    (candidate) => candidate.id === 'HG-F06',
  );
  assert.ok(scene);
  assert.deepEqual(
    scene.visuals.map((visual) => visual.assetId),
    ['kitchen-door-locked', 'witch-reveal', 'gretel-watches-keys', 'gretel-whispers-keys'],
  );
  const narration = utteranceTexts('HG-F06').join(' ');
  assert.ok(
    narration.indexOf('큰 검은 열쇠로 잠갔어요') <
      narration.indexOf('작은 은색 열쇠로 쇠창살 문을 잠갔어요'),
  );
  assert.match(narration, /작은 은색 열쇠는 헨젤의 쇠창살 문에,/);
  assert.match(narration, /큰 검은 열쇠는 복도로 나가는 부엌 문에 썼어요/);
});

test('question anchors derive curiosity prompts from the tagged final script', () => {
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
    '“저 새를 보니 궁금한 게 있어?”',
    '“우린 이 집에 처음 왔어. 들어가기 전에 알아보고 싶은 게 있어?”',
    '“마녀에게 들키지 않고 열쇠를 가져오려면 어떻게 하면 좋을까?”',
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

test('A and C action scripts show the chosen action and rejoin after the base beat', () => {
  const fallbackById = Object.fromEntries(
    hanselGretelPresentation.fallbacks.map((fallback) => [fallback.id, fallback]),
  );
  const visualAssetIds = (familyId: string) =>
    fallbackById[familyId].segments
      .filter((segment) => segment.kind === 'visual')
      .map((segment) => segment.assetId);

  // A-1·A-2: 각자의 행동 그림 → 새를 따라가는 그림 → 04-4 과자집 발견.
  assert.deepEqual(visualAssetIds('A_OBSERVE_BIRD'), ['a-observe-bird-01', 'white-bird-leads']);
  assert.deepEqual(visualAssetIds('A_SPEAK_TO_BIRD'), ['a-speak-to-bird-01', 'white-bird-leads']);
  // C-1은 마녀가 선반으로 돌아선 그림, C-2는 헨젤을 보는 마녀 - 둘 다 07-4로 합류한다.
  assert.deepEqual(visualAssetIds('C_WAIT_FOR_WITCH_TURN'), ['c-wait-for-witch-turn-01']);
  assert.deepEqual(visualAssetIds('C_DISTRACT_AND_TAKE_KEYS'), ['c-distract-and-take-keys-01']);
  for (const family of hanselGretelManifest.fallbackFamilies) {
    assert.equal(
      family.rejoinAnchorId,
      family.id.startsWith('A_') ? 'HG-F04-CANDY-HOUSE-REVEAL' : 'HG-F07-KEYS-TAKEN',
    );
  }

  // C-1은 07-3 기본 원고와 같은 행동이다(아이 제안으로 실행했는지는 기록에서만 구분한다).
  const compact = (texts: string[]) => texts.join('').replace(/\s+/g, '');
  const baseC = hanselGretelPresentation.scenes
    .find((scene) => scene.id === 'HG-F07')
    .segments.filter(
      (segment) => segment.kind === 'utterance' && segment.visualId === 'HG-VIS-F07-02',
    )
    .map((segment) => segment.text);
  const c1 = fallbackById.C_WAIT_FOR_WITCH_TURN.segments
    .filter((segment) => segment.kind === 'utterance')
    .map((segment) => segment.text);
  assert.equal(compact(c1), compact(baseC));
});

test('C action scripts continue at 07-4 without replaying 07-3 and reach F08', () => {
  for (const familyId of ['C_WAIT_FOR_WITCH_TURN', 'C_DISTRACT_AND_TAKE_KEYS']) {
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
        text: '좋아, 열쇠를 가져와 보자.',
        speakerId: 'HG-SPK-GRETEL',
        childRelevantMeaning: '들키지 않고 열쇠를 가져온다.',
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

    const playedTranscripts: string[] = [];
    let guard = 0;
    while (state.status === 'playing-fixed' && state.sceneId === 'HG-F07' && guard < 40) {
      guard += 1;
      const clip = hanselGretelManifest.audioGroups.find(
        (group) => group.id === state.audioGroupId,
      )?.clips[state.clipIndex];
      assert.ok(clip);
      playedTranscripts.push(clip.transcript);
      transition = transitionStoryRuntime(hanselGretelManifest, state, {
        type: 'AUDIO_ENDED',
        clipId: clip.id,
      });
      assert.equal(transition.ok, true);
      if (!transition.ok) return;
      state = transition.state;
    }
    assert.equal(playedTranscripts[0], '그레텔은 작은 은색 열쇠로 쇠창살 문을 열었어요.');
    assert.ok(
      playedTranscripts.every((text) => !text.includes('선반 안을 뒤적였어요')),
      `${familyId} must not replay the 07-3 base beat`,
    );
    assert.equal(state.status, 'playing-fixed');
    assert.equal(state.sceneId, 'HG-F08');
  }
});

test('all visual beats use registered assets and one-breath fixed captions', () => {
  const illustrationRegistryPath = fileURLToPath(
    new URL('../model/story-assets.generated.ts', import.meta.url),
  );
  const illustrationRegistry = readFileSync(illustrationRegistryPath, 'utf8');
  const sceneAssetIds = hanselGretelPresentation.scenes.flatMap((scene) =>
    scene.visuals.map((visual) => visual.assetId),
  );

  assert.equal(new Set(sceneAssetIds).size, SCENE_ASSETS.length);
  assert.deepEqual(sceneAssetIds, SCENE_ASSETS);
  for (const assetId of sceneAssetIds) {
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
    new URL('../../../../assets/story/hansel-gretel/audio/', import.meta.url),
  );
  // Driven by assets.json rather than a hand-written copy of it.
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
  const onDisk = (relativePath: string) => `${appRoot}${relativePath}`;

  // Only illustration originals live in the repo. Narration/bridge audio originals were removed
  // (the Supabase bucket is their only copy - see scripts/upload-story-assets-to-supabase.mjs),
  // so on-disk existence is asserted for images only; audio completeness is checked below
  // against fixed-narration-metadata.json instead.
  const LOCAL_CATEGORIES = new Set(['SCENE_ART', 'BRANCH_ART']);
  for (const asset of packagedAssets.assets) {
    if (!LOCAL_CATEGORIES.has(asset.category)) continue;
    assert.ok(
      existsSync(onDisk(`${packagedAssets.root}${asset.file}`)),
      `${asset.slug} file is missing`,
    );
  }

  // Branch art is fetched mid-question on a phone, so it stays inside the mobile WebP size band.
  const branchArt = packagedAssets.assets.filter(
    (asset) => asset.category === 'BRANCH_ART' && asset.panel === 1,
  );
  assert.equal(branchArt.length, hanselGretelManifest.fallbackFamilies.length);
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
  assert.equal(branchInteractionEntries.length, hanselGretelManifest.fallbackFamilies.length);
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
  // The mp3 originals are not on disk any more (bucket-only), so instead of stat-ing files we
  // assert that every clip the metadata knows about is registered in assets.json - that is what
  // the runtime and the upload script actually read.
  const packagedAudioFiles = new Set(audioFileBySlug.values());
  for (const clip of narrationMetadata.clips) {
    assert.ok(
      packagedAudioFiles.has(`assets/story/hansel-gretel/audio/${clip.fileName}`),
      `${clip.clipId} (${clip.fileName}) is in fixed-narration-metadata.json but not in assets.json`,
    );
  }
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

test('visual continuity follows the final script through the forest and the kitchen escape', () => {
  const visualById = Object.fromEntries(
    hanselGretelPresentation.scenes.flatMap((scene) =>
      scene.visuals.map((visual) => [visual.id, visual]),
    ),
  );
  const visuals = hanselGretelPresentation.scenes.flatMap((scene) => scene.visuals);
  // 장면 안팎으로 바로 이어지는 그림은 앞 그림의 끝 상태에서 시작한다.
  for (const [previousId, nextId] of [
    ['HG-VIS-F02-03', 'HG-VIS-F02-04'],
    ['HG-VIS-F02-04', 'HG-VIS-F02-05'],
    ['HG-VIS-F03-03', 'HG-VIS-F03-04'],
    ['HG-VIS-F03-04', 'HG-VIS-F03-05'],
    ['HG-VIS-F06-01', 'HG-VIS-F06-02'],
    ['HG-VIS-F07-01', 'HG-VIS-F07-02'],
    ['HG-VIS-F07-02', 'HG-VIS-F07-03'],
    ['HG-VIS-F07-04', 'HG-VIS-F07-05'],
    ['HG-VIS-F07-06', 'HG-VIS-F08-01'],
    ['HG-VIS-F08-02', 'HG-VIS-F08-03'],
  ]) {
    assert.equal(
      visualById[previousId].exitState,
      visualById[nextId].entryState,
      `${previousId} -> ${nextId}`,
    );
  }
  // 02-3은 두 어른이 떠나는 순간, 02-4부터는 어른이 없는 밤 숲이다.
  assert.ok(visualById['HG-VIS-F02-03'].characters.includes('FATHER'));
  assert.deepEqual(visualById['HG-VIS-F02-04'].characters, ['HANSEL', 'GRETEL']);
  assert.equal(visualById['HG-VIS-F02-04'].time, 'night');
  assert.deepEqual(visualById['HG-VIS-F03-04'].characters, ['HANSEL', 'GRETEL']);
  assert.equal(visualById['HG-VIS-F03-05'].requiredAction, 'birds-eat-last-crumbs');
  assert.equal(visualById['HG-VIS-F07-05'].exitState, 'witch-locked-in-kitchen');
  assert.equal(visualById['HG-VIS-F08-02'].exitState, 'small-bag-packed');
  assert.equal(visualById['HG-VIS-F08-03'].exitState, 'siblings-outside-candy-house');
  assert.ok(visuals.every((visual) => !/oven|twig|ledger|evidence|pebble-and-feather/.test(visual.requiredAction)));
});
