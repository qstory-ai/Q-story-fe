// @ts-nocheck -- Node 테스트 러너 단정문이 의도적으로 잘못된 런타임 데이터를 검사한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assetId,
  audioClipId,
  audioGroupId,
  createInitialRuntimeState,
  fallbackFamilyId,
  questionAnchorId,
  rejoinAnchorId,
  sceneId,
  speakerId,
  storyId,
  transitionStoryRuntime,
  validateCheckpoint,
  validateStoryManifest,
  visualStateId,
} from './index.ts';

const IDS = {
  story: storyId('HG'),
  scene1: sceneId('HG-F01'),
  scene2: sceneId('HG-F02'),
  visual1: visualStateId('HG-VIS-F01-01'),
  visual2: visualStateId('HG-VIS-F02-01'),
  image1: assetId('HG-F01-IMAGE'),
  image2: assetId('HG-F02-IMAGE'),
  audio1: assetId('HG-F01-AUDIO-01'),
  audio2: assetId('HG-F01-AUDIO-02'),
  audioResume: assetId('HG-F01-AUDIO-RESUME'),
  audioEnding: assetId('HG-F02-AUDIO-01'),
  speaker: speakerId('NARRATOR'),
  group1: audioGroupId('HG-F01-G01'),
  groupResume: audioGroupId('HG-F01-G02'),
  groupEnding: audioGroupId('HG-F02-G01'),
  clip1: audioClipId('HG-F01-C01'),
  clip2: audioClipId('HG-F01-C02'),
  clipResume: audioClipId('HG-F01-C03'),
  clipEnding: audioClipId('HG-F02-C01'),
  question: questionAnchorId('HG-F01-Q01'),
  rejoin: rejoinAnchorId('HG-F01-REJOIN'),
  fallback: fallbackFamilyId('CHECK-SURROUNDINGS'),
  fallback2: fallbackFamilyId('ASK-FRIEND'),
  fallback3: fallbackFamilyId('TRY-OTHER-PATH'),
};

function routePlan(overrides = {}) {
  return {
    kind: 'route',
    route: 'ANSWER_RESUME',
    childRelevantMeaning: '주변이 궁금하다.',
    text: '지금 보이는 단서를 함께 살펴보자.',
    speakerId: IDS.speaker,
    actionFamilyId: null,
    rejoinAt: null,
    fallbackFamilyId: null,
    options: [],
    versions: {
      modelId: 'test-llm',
      promptVersion: 'QSTORY_ROUTE_PROMPT_V1',
      storyManifestVersion: 'test-story-v1',
      routePolicyVersion: 'qstory-route-policy-v1',
    },
    ...overrides,
  };
}

function createManifest() {
  return {
    schemaVersion: 1,
    storyId: IDS.story,
    contentVersion: '0.1.0',
    title: '계약 검사 이야기',
    entrySceneId: IDS.scene1,
    endingSceneId: IDS.scene2,
    scenes: [
      {
        id: IDS.scene1,
        sequence: 1,
        kind: 'fixed',
        entryState: {},
        requiredExitState: { reachedQuestion: true },
        visualStateIds: [IDS.visual1],
        audioGroupIds: [IDS.group1, IDS.groupResume],
        questionAnchorIds: [IDS.question],
        nextSceneId: IDS.scene2,
        checkpoint: true,
      },
      {
        id: IDS.scene2,
        sequence: 2,
        kind: 'fixed',
        entryState: { reachedQuestion: true },
        requiredExitState: { complete: true },
        visualStateIds: [IDS.visual2],
        audioGroupIds: [IDS.groupEnding],
        questionAnchorIds: [],
        nextSceneId: null,
        checkpoint: true,
      },
    ],
    visualStates: [
      {
        id: IDS.visual1,
        sceneId: IDS.scene1,
        masterAssetId: IDS.image1,
        layerAssetIds: [],
        order: 0,
      },
      {
        id: IDS.visual2,
        sceneId: IDS.scene2,
        masterAssetId: IDS.image2,
        layerAssetIds: [],
        order: 0,
      },
    ],
    audioGroups: [
      {
        id: IDS.group1,
        sceneId: IDS.scene1,
        visualStateId: IDS.visual1,
        clips: [
          {
            id: IDS.clip1,
            assetId: IDS.audio1,
            speakerId: IDS.speaker,
            transcript: '첫 번째 문장',
            order: 0,
          },
          {
            id: IDS.clip2,
            assetId: IDS.audio2,
            speakerId: IDS.speaker,
            transcript: '질문 초대',
            order: 1,
          },
        ],
      },
      {
        id: IDS.groupResume,
        sceneId: IDS.scene1,
        visualStateId: IDS.visual1,
        clips: [
          {
            id: IDS.clipResume,
            assetId: IDS.audioResume,
            speakerId: IDS.speaker,
            transcript: '이야기를 계속할게.',
            order: 0,
          },
        ],
      },
      {
        id: IDS.groupEnding,
        sceneId: IDS.scene2,
        visualStateId: IDS.visual2,
        clips: [
          {
            id: IDS.clipEnding,
            assetId: IDS.audioEnding,
            speakerId: IDS.speaker,
            transcript: '이야기 끝.',
            order: 0,
          },
        ],
      },
    ],
    assets: [
      { id: IDS.image1, kind: 'image', uri: 'asset://scene-1.png' },
      { id: IDS.image2, kind: 'image', uri: 'asset://scene-2.png' },
      { id: IDS.audio1, kind: 'audio', uri: 'asset://scene-1-1.mp3' },
      { id: IDS.audio2, kind: 'audio', uri: 'asset://scene-1-2.mp3' },
      {
        id: IDS.audioResume,
        kind: 'audio',
        uri: 'asset://scene-1-resume.mp3',
      },
      {
        id: IDS.audioEnding,
        kind: 'audio',
        uri: 'asset://scene-2-1.mp3',
      },
    ],
    speakers: [
      { id: IDS.speaker, role: 'narrator', displayName: '이야기꾼' },
    ],
    questionAnchors: [
      {
        id: IDS.question,
        sceneId: IDS.scene1,
        afterAudioGroupId: IDS.group1,
        prompt: '여기서 뭐가 궁금해?',
        promptSpeakerId: IDS.speaker,
        interactionMode: 'curiosity',
        acceptedInputKinds: ['question', 'guess', 'warning', 'plan'],
        allowedActions: ['ask', 'type', 'continue-story'],
        resumeAudioGroupId: IDS.groupResume,
        allowedRejoinAnchorIds: [IDS.rejoin],
        fallbackFamilyIds: [IDS.fallback],
        defaultFallbackFamilyId: IDS.fallback,
      },
    ],
    rejoinAnchors: [
      {
        id: IDS.rejoin,
        sceneId: IDS.scene1,
        nextSceneId: IDS.scene2,
        requiredState: { reachedQuestion: true },
      },
    ],
    fallbackFamilies: [
      {
        id: IDS.fallback,
        meaning: '주변을 살피고 계속하기',
        audioGroupId: IDS.groupResume,
        rejoinAnchorId: IDS.rejoin,
      },
    ],
  };
}

test('valid story manifest passes reference validation', () => {
  const manifest = createManifest();
  const result = validateStoryManifest(manifest);
  assert.equal(result.ok, true);
});

test('a rejected transcript returns to recording at the same question anchor', () => {
  const manifest = createManifest();
  const transition = transitionStoryRuntime(
    manifest,
    {
      status: 'processing-question',
      sceneId: IDS.scene1,
      anchorId: IDS.question,
      questionRound: 1,
      consecutiveSafetyFailures: 0,
      inputMode: 'voice',
    },
    { type: 'RETRY_QUESTION_SELECTED' },
  );

  assert.equal(transition.ok, true);
  if (!transition.ok) {
    return;
  }
  assert.deepEqual(transition.state, {
    status: 'recording-question',
    sceneId: IDS.scene1,
    anchorId: IDS.question,
    questionRound: 1,
    consecutiveSafetyFailures: 0,
    inputMode: 'voice',
  });
  assert.deepEqual(transition.commands, [{ type: 'REQUEST_RECORDING' }]);
});

test('voice and text input can switch at the same question anchor', () => {
  const manifest = createManifest();
  const switchedToText = transitionStoryRuntime(
    manifest,
    {
      status: 'recording-question',
      sceneId: IDS.scene1,
      anchorId: IDS.question,
      questionRound: 1,
      consecutiveSafetyFailures: 0,
      inputMode: 'voice',
    },
    { type: 'TYPE_SELECTED' },
  );

  assert.equal(switchedToText.ok, true);
  if (!switchedToText.ok) {
    return;
  }
  assert.deepEqual(switchedToText.state, {
    status: 'recording-question',
    sceneId: IDS.scene1,
    anchorId: IDS.question,
    questionRound: 1,
    consecutiveSafetyFailures: 0,
    inputMode: 'text',
  });
  assert.deepEqual(switchedToText.commands, []);

  const switchedBackToVoice = transitionStoryRuntime(
    manifest,
    switchedToText.state,
    { type: 'ASK_SELECTED' },
  );
  assert.equal(switchedBackToVoice.ok, true);
  if (!switchedBackToVoice.ok) {
    return;
  }
  assert.equal(switchedBackToVoice.state.inputMode, 'voice');
  assert.deepEqual(switchedBackToVoice.commands, [
    { type: 'REQUEST_RECORDING' },
  ]);
});

test('a failed voice attempt can switch to text or skip without consuming the anchor', () => {
  const manifest = createManifest();
  const failed = {
    status: 'failed-recoverable',
    sceneId: IDS.scene1,
    anchorId: IDS.question,
    questionRound: 1,
    inputMode: 'voice',
    failure: {
      code: 'STT_TIMEOUT',
      stage: 'stt',
      retryable: true,
    },
  };

  const switched = transitionStoryRuntime(manifest, failed, {
    type: 'TYPE_SELECTED',
  });
  assert.equal(switched.ok, true);
  assert.equal(switched.state.status, 'recording-question');
  assert.equal(switched.state.inputMode, 'text');

  const skipped = transitionStoryRuntime(manifest, failed, {
    type: 'CONTINUE_SELECTED',
  });
  assert.equal(skipped.ok, true);
  assert.equal(skipped.state.status, 'playing-fixed');
  assert.equal(skipped.state.audioGroupId, IDS.groupResume);
});

test('duplicate ids and orphan references are rejected', () => {
  const manifest = createManifest();
  manifest.scenes[1].id = manifest.scenes[0].id;
  manifest.audioGroups[0].visualStateId = visualStateId('MISSING-VISUAL');

  const result = validateStoryManifest(manifest);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === 'DUPLICATE_ID'));
  assert.ok(
    result.issues.some((issue) => issue.code === 'MISSING_REFERENCE'),
  );
});

test('scene cycles are rejected', () => {
  const manifest = createManifest();
  manifest.scenes[1].nextSceneId = IDS.scene1;

  const result = validateStoryManifest(manifest);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === 'SCENE_CYCLE'));
});

test('checkpoint rejects multiple prior traces', () => {
  const manifest = createManifest();
  const result = validateCheckpoint(
    {
      schemaVersion: 1,
      storyId: IDS.story,
      contentVersion: manifest.contentVersion,
      completedSceneId: IDS.scene1,
      nextSceneId: IDS.scene2,
      priorTrace: [{ kind: 'SIGNAL' }, { kind: 'ALLY' }],
      questionRound: 1,
      savedAt: new Date().toISOString(),
    },
    manifest,
  );

  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some((issue) => issue.code === 'MULTIPLE_PRIOR_TRACES'),
  );
});

test('unreachable scenes are rejected', () => {
  const manifest = createManifest();
  manifest.scenes.push({
    id: sceneId('HG-F99'),
    sequence: 99,
    kind: 'fixed',
    entryState: {},
    requiredExitState: {},
    visualStateIds: [],
    audioGroupIds: [],
    questionAnchorIds: [],
    nextSceneId: null,
    checkpoint: true,
  });

  const result = validateStoryManifest(manifest);
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some((issue) => issue.code === 'UNREACHABLE_SCENE'),
  );
});

test('fixed playback reaches a question only after the last clip', () => {
  const manifest = createManifest();
  const initial = createInitialRuntimeState(manifest);
  const started = transitionStoryRuntime(manifest, initial, { type: 'START' });
  assert.equal(started.ok, true);
  assert.equal(started.state.status, 'playing-fixed');
  assert.equal(started.state.clipIndex, 0);

  const afterFirstClip = transitionStoryRuntime(manifest, started.state, {
    type: 'AUDIO_ENDED',
    clipId: IDS.clip1,
  });
  assert.equal(afterFirstClip.ok, true);
  assert.equal(afterFirstClip.state.status, 'playing-fixed');
  assert.equal(afterFirstClip.state.clipIndex, 1);

  const afterInvite = transitionStoryRuntime(
    manifest,
    afterFirstClip.state,
    { type: 'AUDIO_ENDED', clipId: IDS.clip2 },
  );
  assert.equal(afterInvite.ok, true);
  assert.equal(afterInvite.state.status, 'awaiting-question');
  assert.equal(afterInvite.state.anchorId, IDS.question);
});

test('continue resumes fixed audio and reaches the ending', () => {
  const manifest = createManifest();
  let result = transitionStoryRuntime(
    manifest,
    createInitialRuntimeState(manifest),
    { type: 'START' },
  );
  result = transitionStoryRuntime(manifest, result.state, {
    type: 'AUDIO_ENDED',
    clipId: IDS.clip1,
  });
  result = transitionStoryRuntime(manifest, result.state, {
    type: 'AUDIO_ENDED',
    clipId: IDS.clip2,
  });
  result = transitionStoryRuntime(manifest, result.state, {
    type: 'CONTINUE_SELECTED',
  });
  assert.equal(result.ok, true);
  assert.equal(result.state.status, 'playing-fixed');
  assert.equal(result.state.audioGroupId, IDS.groupResume);

  result = transitionStoryRuntime(manifest, result.state, {
    type: 'AUDIO_ENDED',
    clipId: IDS.clipResume,
  });
  assert.equal(result.ok, true);
  assert.equal(result.state.status, 'playing-fixed');
  assert.equal(result.state.audioGroupId, IDS.groupEnding);

  result = transitionStoryRuntime(manifest, result.state, {
    type: 'AUDIO_ENDED',
    clipId: IDS.clipEnding,
  });
  assert.equal(result.ok, true);
  assert.equal(result.state.status, 'complete');
});

test('skip scene starts the next scene and completes from the ending', () => {
  const manifest = createManifest();
  const started = transitionStoryRuntime(
    manifest,
    createInitialRuntimeState(manifest),
    { type: 'START' },
  );
  const skipped = transitionStoryRuntime(manifest, started.state, {
    type: 'SKIP_SCENE_SELECTED',
  });
  assert.equal(skipped.ok, true);
  assert.equal(skipped.state.status, 'playing-fixed');
  assert.equal(skipped.state.sceneId, IDS.scene2);
  assert.equal(skipped.state.audioGroupId, IDS.groupEnding);

  const completed = transitionStoryRuntime(manifest, skipped.state, {
    type: 'SKIP_SCENE_SELECTED',
  });
  assert.equal(completed.ok, true);
  assert.equal(completed.state.status, 'complete');
});

test('ask moves recording into processing', () => {
  const manifest = createManifest();
  const waiting = {
    status: 'awaiting-question',
    sceneId: IDS.scene1,
    anchorId: IDS.question,
    questionRound: 1,
  };
  const recording = transitionStoryRuntime(manifest, waiting, {
    type: 'ASK_SELECTED',
  });
  assert.equal(recording.ok, true);
  assert.equal(recording.state.status, 'recording-question');

  const processing = transitionStoryRuntime(manifest, recording.state, {
    type: 'RECORDING_STOPPED',
    recording: {
      uri: 'file://question.m4a',
      durationMillis: 1200,
      mimeType: 'audio/mp4',
      byteSize: 4200,
    },
  });
  assert.equal(processing.ok, true);
  assert.equal(processing.state.status, 'processing-question');
  assert.equal(processing.commands[0].type, 'PROCESS_RECORDING');
});

test('no-speech exits processing through a recoverable failure', () => {
  const manifest = createManifest();
  const processing = {
    status: 'processing-question',
    sceneId: IDS.scene1,
    anchorId: IDS.question,
    questionRound: 2,
    inputMode: 'voice',
  };
  const result = transitionStoryRuntime(manifest, processing, {
    type: 'SPEECH_RESOLVED',
    result: { status: 'no-speech', reason: 'unintelligible' },
  });

  assert.equal(result.ok, true);
  assert.equal(result.state.status, 'failed-recoverable');
  assert.equal(result.state.anchorId, IDS.question);
  assert.equal(result.state.failure.code, 'NO_SPEECH_UNINTELLIGIBLE');
});

test('approved fallback recovers a failed question into response playback', () => {
  const manifest = createManifest();
  const failed = {
    status: 'failed-recoverable',
    sceneId: IDS.scene1,
    anchorId: IDS.question,
    questionRound: 2,
    inputMode: 'voice',
    failure: {
      code: 'STT_TIMEOUT',
      stage: 'stt',
      retryable: false,
    },
  };
  const result = transitionStoryRuntime(manifest, failed, {
    type: 'FALLBACK_READY',
    plan: {
      kind: 'fallback',
      familyId: IDS.fallback,
      text: '주변을 살피며 계속 가 보자.',
      rejoinAt: IDS.rejoin,
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.state.status, 'playing-response');
  assert.equal(result.state.questionRound, 2);
});

test('response cannot rejoin through an unapproved anchor', () => {
  const manifest = createManifest();
  const processing = {
    status: 'processing-question',
    sceneId: IDS.scene1,
    anchorId: IDS.question,
    questionRound: 1,
    inputMode: 'voice',
  };
  const result = transitionStoryRuntime(manifest, processing, {
    type: 'RESPONSE_READY',
    plan: {
      kind: 'story-change',
      childRelevantMeaning: '다른 길을 확인한다',
      text: '다른 길을 살펴보자.',
      requiredStateChange: {},
      rejoinAt: rejoinAnchorId('UNAPPROVED-REJOIN'),
      fallbackFamilyId: IDS.fallback,
      trace: null,
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.state, processing);
});

test('short response resumes the fixed story after playback ends', () => {
  const manifest = createManifest();
  const playingResponse = {
    status: 'playing-response',
    sceneId: IDS.scene1,
    anchorId: IDS.question,
    questionRound: 1,
    plan: {
      kind: 'short-answer',
      text: '좋은 질문이야. 이제 이야기를 계속 들어보자.',
      resumeAt: IDS.question,
    },
  };
  const result = transitionStoryRuntime(manifest, playingResponse, {
    type: 'RESPONSE_AUDIO_ENDED',
  });

  assert.equal(result.ok, true);
  assert.equal(result.state.status, 'playing-fixed');
  assert.equal(result.state.audioGroupId, IDS.groupResume);
});

test('approved story change rejoins at the fixed destination', () => {
  const manifest = createManifest();
  const playingResponse = {
    status: 'playing-response',
    sceneId: IDS.scene1,
    anchorId: IDS.question,
    questionRound: 1,
    plan: {
      kind: 'story-change',
      childRelevantMeaning: '주변을 먼저 살핀다',
      text: '남매는 주변을 꼼꼼히 살폈어.',
      requiredStateChange: { reachedQuestion: true },
      rejoinAt: IDS.rejoin,
      fallbackFamilyId: IDS.fallback,
      trace: null,
    },
  };
  const result = transitionStoryRuntime(manifest, playingResponse, {
    type: 'RESPONSE_AUDIO_ENDED',
  });

  assert.equal(result.ok, true);
  assert.equal(result.state.status, 'playing-fixed');
  assert.equal(result.state.audioGroupId, IDS.groupEnding);
});

test('direct action starts the selected canonical family without choices', () => {
  const manifest = createManifest();
  const processing = {
    status: 'processing-question',
    sceneId: IDS.scene1,
    anchorId: IDS.question,
    questionRound: 1,
    inputMode: 'voice',
  };
  const result = transitionStoryRuntime(manifest, processing, {
    type: 'RESPONSE_READY',
    plan: routePlan({
      route: 'DIRECT_ACTION',
      actionFamilyId: IDS.fallback,
      rejoinAt: IDS.rejoin,
      fallbackFamilyId: IDS.fallback,
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.state.status, 'playing-response');
  assert.equal(result.state.plan.actionFamilyId, IDS.fallback);
  const rejoined = transitionStoryRuntime(manifest, result.state, {
    type: 'RESPONSE_AUDIO_ENDED',
  });
  assert.equal(rejoined.ok, true);
  assert.equal(rejoined.state.status, 'playing-fixed');
  assert.equal(rejoined.state.audioGroupId, IDS.groupEnding);
});

test('direct action uses the selected family rejoin even when the server sends another allowed anchor', () => {
  const manifest = createManifest();
  const wrongRejoin = rejoinAnchorId('HG-F01-OTHER-ALLOWED-REJOIN');
  manifest.questionAnchors[0].allowedRejoinAnchorIds.push(wrongRejoin);
  manifest.rejoinAnchors.push({
    id: wrongRejoin,
    sceneId: IDS.scene1,
    nextSceneId: IDS.scene1,
    resumeAudioGroupId: IDS.groupResume,
    requiredState: { reachedQuestion: true },
  });
  const processing = {
    status: 'processing-question',
    sceneId: IDS.scene1,
    anchorId: IDS.question,
    questionRound: 1,
    inputMode: 'voice',
  };
  const result = transitionStoryRuntime(manifest, processing, {
    type: 'RESPONSE_READY',
    plan: routePlan({
      route: 'DIRECT_ACTION',
      actionFamilyId: IDS.fallback,
      rejoinAt: wrongRejoin,
      fallbackFamilyId: IDS.fallback,
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.state.status, 'playing-response');
  assert.equal(result.state.plan.actionFamilyId, IDS.fallback);
  assert.equal(result.state.plan.fallbackFamilyId, IDS.fallback);
  assert.equal(result.state.plan.rejoinAt, IDS.rejoin);
  assert.equal(result.commands[0].plan.rejoinAt, IDS.rejoin);
});

test('three paths waits for a choice and plays only the selected family', () => {
  const manifest = createManifest();
  manifest.questionAnchors[0].fallbackFamilyIds.push(
    IDS.fallback2,
    IDS.fallback3,
  );
  manifest.fallbackFamilies.push({
    id: IDS.fallback2,
    meaning: '선택한 가족만의 독립 합류',
    audioGroupId: IDS.groupResume,
    rejoinAnchorId: null,
  });
  const processing = {
    status: 'processing-question',
    sceneId: IDS.scene1,
    anchorId: IDS.question,
    questionRound: 1,
    inputMode: 'voice',
  };
  const choicePlan = routePlan({
    route: 'THREE_PATHS',
    text: '어떤 방법으로 확인해 볼까?',
    rejoinAt: IDS.rejoin,
    fallbackFamilyId: IDS.fallback,
    options: [
      {
        id: 'OPTION_1',
        label: '주변 보기',
        meaning: '주변 단서를 살핀다.',
        actionFamilyId: IDS.fallback,
      },
      {
        id: 'OPTION_2',
        label: '친구에게 묻기',
        meaning: '친구에게 안전하게 묻는다.',
        actionFamilyId: IDS.fallback2,
      },
      {
        id: 'OPTION_3',
        label: '다른 길 보기',
        meaning: '표시를 남기고 다른 길을 본다.',
        actionFamilyId: IDS.fallback3,
      },
    ],
  });
  const awaiting = transitionStoryRuntime(manifest, processing, {
    type: 'RESPONSE_READY',
    plan: choicePlan,
  });

  assert.equal(awaiting.ok, true);
  assert.equal(awaiting.state.status, 'awaiting-choice');
  assert.equal(awaiting.commands.length, 0);

  const selected = transitionStoryRuntime(manifest, awaiting.state, {
    type: 'CHOICE_SELECTED',
    optionId: 'OPTION_2',
  });
  assert.equal(selected.ok, true);
  assert.equal(selected.state.status, 'playing-response');
  assert.equal(selected.state.plan.actionFamilyId, IDS.fallback2);
  assert.equal(selected.state.plan.originRoute, 'THREE_PATHS');
  assert.equal(selected.state.plan.selectedOptionId, 'OPTION_2');
  assert.equal(selected.state.plan.rejoinAt, null);
  assert.equal(selected.state.plan.options.length, 0);
});

test('route runtime rejects unknown families and duplicate choices', () => {
  const manifest = createManifest();
  const processing = {
    status: 'processing-question',
    sceneId: IDS.scene1,
    anchorId: IDS.question,
    questionRound: 1,
    inputMode: 'voice',
  };
  const unknownFamily = transitionStoryRuntime(manifest, processing, {
    type: 'RESPONSE_READY',
    plan: routePlan({
      route: 'DIRECT_ACTION',
      actionFamilyId: fallbackFamilyId('UNKNOWN'),
      rejoinAt: IDS.rejoin,
      fallbackFamilyId: IDS.fallback,
    }),
  });
  assert.equal(unknownFamily.ok, false);

  manifest.questionAnchors[0].fallbackFamilyIds.push(
    IDS.fallback2,
    IDS.fallback3,
  );
  const duplicated = transitionStoryRuntime(manifest, processing, {
    type: 'RESPONSE_READY',
    plan: routePlan({
      route: 'THREE_PATHS',
      rejoinAt: IDS.rejoin,
      fallbackFamilyId: IDS.fallback,
      options: [
        {
          id: 'OPTION_1',
          label: '같은 방법',
          meaning: '첫 방법',
          actionFamilyId: IDS.fallback,
        },
        {
          id: 'OPTION_2',
          label: '같은 방법',
          meaning: '둘째 방법',
          actionFamilyId: IDS.fallback2,
        },
        {
          id: 'OPTION_3',
          label: '다른 방법',
          meaning: '셋째 방법',
          actionFamilyId: IDS.fallback3,
        },
      ],
    }),
  });
  assert.equal(duplicated.ok, false);
});

test('clarify once returns to the same anchor for one more input', () => {
  const manifest = createManifest();
  const playing = {
    status: 'playing-response',
    sceneId: IDS.scene1,
    anchorId: IDS.question,
    questionRound: 1,
    plan: routePlan({
      route: 'CLARIFY_ONCE',
      text: '주변을 살펴보자는 뜻이니?',
    }),
  };
  const result = transitionStoryRuntime(manifest, playing, {
    type: 'RESPONSE_AUDIO_ENDED',
  });

  assert.equal(result.ok, true);
  assert.equal(result.state.status, 'awaiting-clarification');
  assert.equal(result.state.questionRound, 2);
  assert.equal(result.state.prompt, '주변을 살펴보자는 뜻이니?');
});

test('cross-scene content references are rejected', () => {
  const manifest = createManifest();
  manifest.audioGroups[0].visualStateId = IDS.visual2;

  const result = validateStoryManifest(manifest);
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some((issue) => issue.code === 'CROSS_SCENE_REFERENCE'),
  );
});

test('an unexpected audio completion does not corrupt state', () => {
  const manifest = createManifest();
  const started = transitionStoryRuntime(
    manifest,
    createInitialRuntimeState(manifest),
    { type: 'START' },
  );
  const result = transitionStoryRuntime(manifest, started.state, {
    type: 'AUDIO_ENDED',
    clipId: IDS.clipEnding,
  });

  assert.equal(result.ok, false);
  assert.equal(result.state, started.state);
});

test('a live-branch job id short-circuits THREE_PATHS normalization into generating-branch', () => {
  const manifest = createManifest();
  const processing = {
    status: 'processing-question',
    sceneId: IDS.scene1,
    anchorId: IDS.question,
    questionRound: 1,
    inputMode: 'voice',
  };
  // 이 plan은 옵션이 비어 있지 않으면서도(THREE_PATHS 모양이 아님) actionFamilyId/rejoinAt도
  // 없는, routePlanIssue라면 거부했을 형태다 - liveBranchJobId가 있으면 그 검증보다 먼저
  // generating-branch로 빠져야 한다는 것을 확인한다.
  const waitingPlan = routePlan({
    route: 'ANSWER_RESUME',
    text: '그것도 한번 알아볼게, 잠깐만 기다려줘!',
    liveBranchJobId: 'job-123',
  });
  const result = transitionStoryRuntime(manifest, processing, {
    type: 'RESPONSE_READY',
    plan: waitingPlan,
  });

  assert.equal(result.ok, true);
  assert.equal(result.state.status, 'generating-branch');
  assert.equal(result.state.jobId, 'job-123');
  assert.equal(result.commands.length, 0);
});

test('live branch failure or timeout falls back to the existing gentle-redirect flow', () => {
  const manifest = createManifest();
  const generating = {
    status: 'generating-branch',
    sceneId: IDS.scene1,
    anchorId: IDS.question,
    questionRound: 1,
    jobId: 'job-123',
    plan: routePlan({
      route: 'ANSWER_RESUME',
      text: '그것도 한번 알아볼게, 잠깐만 기다려줘!',
      liveBranchJobId: 'job-123',
    }),
  };
  const failed = transitionStoryRuntime(manifest, generating, {
    type: 'LIVE_BRANCH_FAILED',
  });

  assert.equal(failed.ok, true);
  assert.equal(failed.state.status, 'playing-response');
  assert.equal(failed.state.plan.route, 'GENTLE_REDIRECT');
  assert.equal(failed.state.plan.actionFamilyId, null);
  assert.equal(failed.state.plan.rejoinAt, null);
  assert.equal(failed.state.plan.liveBranchJobId, undefined);

  // GENTLE_REDIRECT는 rejoinAt이 없으니, 기존 continueFromAnchor 경로로 이야기가 이어진다.
  const resumed = transitionStoryRuntime(manifest, failed.state, {
    type: 'RESPONSE_AUDIO_ENDED',
  });
  assert.equal(resumed.ok, true);
  assert.equal(resumed.state.status, 'playing-fixed');
  assert.equal(resumed.state.audioGroupId, IDS.groupResume);
});

test('live branch ready presents exactly three options as a THREE_PATHS choice instead of auto-playing', () => {
  const manifest = createManifest();
  const liveFamilyId = fallbackFamilyId('LIVE_HG_F01_ABCDEF01');
  // GET /v1/stories/{storyId}/content 재조회 뒤의 manifest를 흉내낸다 - Phase 2부터는 새로
  // 생성된 family만 자동재생하지 않고, 새 family + 모자란 자리를 채운 기존 family를 합쳐
  // 항상 정확히 3개를 THREE_PATHS로 제시한다(설계 문서 §3 참고). 새로 커밋된 family는 이미
  // 앵커의 fallbackFamilyIds에 포함되어 있어야 한다(백엔드가 처음부터 채워 넣는다).
  manifest.questionAnchors[0].fallbackFamilyIds = [
    ...manifest.questionAnchors[0].fallbackFamilyIds,
    liveFamilyId,
    IDS.fallback2,
    IDS.fallback3,
  ];
  manifest.fallbackFamilies = [
    ...manifest.fallbackFamilies,
    {
      id: liveFamilyId,
      meaning: '아이의 질문에서 새로 만들어진 이야기',
      acknowledgementText: '좋아, 그것도 함께 알아보자!',
      audioGroupId: IDS.groupResume,
      rejoinAnchorId: IDS.rejoin,
    },
    {
      id: IDS.fallback2,
      meaning: '모자란 자리를 채운 기존 방법 1',
      audioGroupId: IDS.groupResume,
      rejoinAnchorId: IDS.rejoin,
    },
    {
      id: IDS.fallback3,
      meaning: '모자란 자리를 채운 기존 방법 2',
      audioGroupId: IDS.groupResume,
      rejoinAnchorId: null,
    },
  ];
  const generating = {
    status: 'generating-branch',
    sceneId: IDS.scene1,
    anchorId: IDS.question,
    questionRound: 1,
    consecutiveSafetyFailures: 0,
    jobId: 'job-123',
    plan: routePlan({
      route: 'ANSWER_RESUME',
      text: '그것도 한번 알아볼게, 잠깐만 기다려줘!',
      liveBranchJobId: 'job-123',
    }),
  };

  const missingFamily = transitionStoryRuntime(manifest, generating, {
    type: 'LIVE_BRANCH_READY',
    options: [
      {
        familyId: fallbackFamilyId('LIVE_NOT_COMMITTED'),
        label: '레이블',
        meaning: '뜻',
      },
      { familyId: IDS.fallback2, label: '레이블2', meaning: '뜻2' },
      { familyId: IDS.fallback3, label: '레이블3', meaning: '뜻3' },
    ],
  });
  assert.equal(missingFamily.ok, false);

  const ready = transitionStoryRuntime(manifest, generating, {
    type: 'LIVE_BRANCH_READY',
    options: [
      {
        familyId: liveFamilyId,
        label: '새로 만든 방법',
        meaning: '아이가 물어본 새로운 방법을 시도한다.',
      },
      { familyId: IDS.fallback2, label: '기존 방법 1', meaning: '기존 선택지 1' },
      { familyId: IDS.fallback3, label: '기존 방법 2', meaning: '기존 선택지 2' },
    ],
  });
  assert.equal(ready.ok, true);
  assert.equal(ready.state.status, 'awaiting-choice');
  assert.equal(ready.state.plan.route, 'THREE_PATHS');
  assert.equal(ready.state.plan.options.length, 3);
  assert.equal(ready.state.plan.options[0].actionFamilyId, liveFamilyId);
  assert.equal(ready.state.plan.actionFamilyId, null);
  assert.equal(ready.state.plan.liveBranchJobId, undefined);
  assert.equal(ready.commands.length, 0);

  // 아이가 새로 만들어진 첫 번째 옵션을 직접 고르면, 기존 THREE_PATHS 선택 흐름과 완전히
  // 동일하게 처리된다(selectRouteOption/CHOICE_SELECTED 참고) - 새 재생 UI가 필요 없다.
  const selected = transitionStoryRuntime(manifest, ready.state, {
    type: 'CHOICE_SELECTED',
    optionId: 'OPTION_1',
  });
  assert.equal(selected.ok, true);
  assert.equal(selected.state.status, 'playing-response');
  assert.equal(selected.state.plan.route, 'DIRECT_ACTION');
  assert.equal(selected.state.plan.actionFamilyId, liveFamilyId);
  assert.equal(selected.state.plan.text, '좋아, 그것도 함께 알아보자!');
  assert.equal(selected.state.plan.rejoinAt, IDS.rejoin);
  assert.equal(selected.commands[0].type, 'PLAY_RESPONSE');

  // 실제 아이가 세 갈래 선택지를 고른 것과 완전히 같은 rejoin 경로를 탄다.
  const rejoined = transitionStoryRuntime(manifest, selected.state, {
    type: 'RESPONSE_AUDIO_ENDED',
  });
  assert.equal(rejoined.ok, true);
  assert.equal(rejoined.state.status, 'playing-fixed');
  assert.equal(rejoined.state.audioGroupId, IDS.groupEnding);
});

test('a gentle-redirect safety failure re-asks via awaiting-safety-retry while under three consecutive failures', () => {
  const manifest = createManifest();
  const playing = {
    status: 'playing-response',
    sceneId: IDS.scene1,
    anchorId: IDS.question,
    questionRound: 1,
    consecutiveSafetyFailures: 0,
    plan: routePlan({
      route: 'GENTLE_REDIRECT',
      text: '그건 이야기랑 조금 다른 이야기인 것 같아.',
    }),
  };
  const result = transitionStoryRuntime(manifest, playing, {
    type: 'RESPONSE_AUDIO_ENDED',
  });

  assert.equal(result.ok, true);
  assert.equal(result.state.status, 'awaiting-safety-retry');
  assert.equal(result.state.questionRound, 2);
  assert.equal(result.state.consecutiveSafetyFailures, 1);
  assert.equal(result.state.prompt, '그건 이야기랑 조금 다른 이야기인 것 같아.');

  // 재질문 UI에서 다시 말하기를 고르면(ASK_SELECTED) 안전게이트 카운터를 그대로 들고
  // recording-question으로 넘어간다(questionRound와 완전히 같은 방식).
  const asked = transitionStoryRuntime(manifest, result.state, {
    type: 'ASK_SELECTED',
  });
  assert.equal(asked.ok, true);
  assert.equal(asked.state.status, 'recording-question');
  assert.equal(asked.state.questionRound, 2);
  assert.equal(asked.state.consecutiveSafetyFailures, 1);
});

test('a third consecutive safety-gate redirect stops re-asking and continues the story instead', () => {
  const manifest = createManifest();
  const playing = {
    status: 'playing-response',
    sceneId: IDS.scene1,
    anchorId: IDS.question,
    questionRound: 3,
    consecutiveSafetyFailures: 2,
    plan: routePlan({
      route: 'GENTLE_REDIRECT',
      text: '이번에도 이야기와는 조금 다른 것 같아.',
    }),
  };
  const result = transitionStoryRuntime(manifest, playing, {
    type: 'RESPONSE_AUDIO_ENDED',
  });

  // 3번째 연속 실패이므로 4번째 재질문(awaiting-safety-retry)으로 가지 않는다 - 기존
  // GENTLE_REDIRECT의 fallthrough(continueFromAnchor)를 그대로 타 이야기를 이어간다.
  assert.equal(result.ok, true);
  assert.notEqual(result.state.status, 'awaiting-safety-retry');
  assert.equal(result.state.status, 'playing-fixed');
  assert.equal(result.state.audioGroupId, IDS.groupResume);
});
