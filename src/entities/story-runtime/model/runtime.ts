import type {
  AudioClipId,
  AudioGroupId,
  FallbackFamilyId,
  QuestionAnchorId,
  RejoinAnchorId,
  SceneId,
  StoryId,
} from './ids';
import type {
  AudioGroup,
  QuestionAnchor,
  StoryCheckpoint,
  StoryManifest,
  StoryScene,
} from './content';
import type {
  FailureReason,
  FallbackPlan,
  LocalRecordingArtifact,
  ResponsePlan,
  RoutePlan,
  SpeechResult,
} from './speech';

export type QuestionInputMode = 'voice' | 'text';

export type StoryRuntimeState =
  | { status: 'idle'; storyId: StoryId }
  | {
      status: 'playing-fixed';
      sceneId: SceneId;
      audioGroupId: AudioGroupId;
      clipIndex: number;
    }
  | {
      status: 'awaiting-question';
      sceneId: SceneId;
      anchorId: QuestionAnchorId;
      questionRound: number;
    }
  | {
      status: 'recording-question';
      sceneId: SceneId;
      anchorId: QuestionAnchorId;
      questionRound: number;
      inputMode: QuestionInputMode;
    }
  | {
      status: 'awaiting-choice';
      sceneId: SceneId;
      anchorId: QuestionAnchorId;
      questionRound: number;
      plan: RoutePlan;
    }
  | {
      status: 'awaiting-clarification';
      sceneId: SceneId;
      anchorId: QuestionAnchorId;
      questionRound: number;
      prompt: string;
    }
  | {
      status: 'processing-question';
      sceneId: SceneId;
      anchorId: QuestionAnchorId;
      questionRound: number;
      inputMode: QuestionInputMode;
    }
  | {
      status: 'playing-response';
      sceneId: SceneId;
      anchorId: QuestionAnchorId;
      questionRound: number;
      plan: ResponsePlan;
    }
  | {
      status: 'rejoining';
      sceneId: SceneId;
      rejoinAnchorId: RejoinAnchorId;
    }
  | {
      status: 'failed-recoverable';
      sceneId: SceneId;
      anchorId?: QuestionAnchorId;
      questionRound?: number;
      inputMode?: QuestionInputMode;
      failure: FailureReason;
      fallbackFamilyId?: FallbackFamilyId;
    }
  | {
      status: 'complete';
      storyId: StoryId;
      completedSceneId: SceneId;
    };

export type StoryRuntimeEvent =
  | { type: 'START' }
  | { type: 'AUDIO_ENDED'; clipId: AudioClipId }
  | { type: 'SKIP_SCENE_SELECTED' }
  | { type: 'ASK_SELECTED' }
  | { type: 'TYPE_SELECTED' }
  | { type: 'CONTINUE_SELECTED' }
  | { type: 'RECORDING_STARTED' }
  | { type: 'RECORDING_STOPPED'; recording: LocalRecordingArtifact }
  | { type: 'TEXT_SUBMITTED'; transcript: string }
  | { type: 'RETRY_QUESTION_SELECTED' }
  | { type: 'SPEECH_RESOLVED'; result: SpeechResult }
  | { type: 'RESPONSE_READY'; plan: ResponsePlan }
  | {
      type: 'CHOICE_SELECTED';
      optionId: 'OPTION_1' | 'OPTION_2' | 'OPTION_3';
    }
  | { type: 'RESPONSE_AUDIO_ENDED' }
  | { type: 'FAILURE'; failure: FailureReason }
  | { type: 'FALLBACK_READY'; plan: FallbackPlan };

export type PlaybackCommand =
  | {
      type: 'PLAY_AUDIO';
      audioGroupId: AudioGroupId;
      startClipIndex: number;
    }
  | { type: 'WAIT_FOR_QUESTION'; anchorId: QuestionAnchorId }
  | { type: 'REQUEST_RECORDING' }
  | {
      type: 'PROCESS_RECORDING';
      recording: LocalRecordingArtifact;
    }
  | { type: 'PROCESS_TEXT'; transcript: string }
  | { type: 'PLAY_RESPONSE'; plan: ResponsePlan }
  | { type: 'SAVE_CHECKPOINT'; checkpoint: StoryCheckpoint }
  | { type: 'SHOW_PARENT_RECOVERY'; failure: FailureReason }
  | { type: 'STORY_COMPLETED' };

export type RuntimeTransition =
  | {
      ok: true;
      state: StoryRuntimeState;
      commands: readonly PlaybackCommand[];
    }
  | {
      ok: false;
      state: StoryRuntimeState;
      failure: FailureReason;
    };

const invalidTransition = (
  state: StoryRuntimeState,
  event: StoryRuntimeEvent,
  detail?: string,
): RuntimeTransition => ({
  ok: false,
  state,
  failure: {
    code: `INVALID_TRANSITION_${state.status}_${event.type}`,
    stage: 'checkpoint',
    retryable: false,
    safeDetail: detail,
  },
});

const findScene = (manifest: StoryManifest, id: SceneId) =>
  manifest.scenes.find((scene) => scene.id === id);

const findAudioGroup = (manifest: StoryManifest, id: AudioGroupId) =>
  manifest.audioGroups.find((group) => group.id === id);

const findAnchor = (manifest: StoryManifest, id: QuestionAnchorId) =>
  manifest.questionAnchors.find((anchor) => anchor.id === id);

const SIMPLE_ROUTE_KINDS = new Set([
  'ANSWER_RESUME',
  'CLARIFY_ONCE',
  'GENTLE_REDIRECT',
  'SKIP_CONTINUE',
]);
const ACTION_ROUTE_KINDS = new Set([
  'DIRECT_ACTION',
  'SCENE_REPLACE',
  'DETOUR_REJOIN',
]);

function routePlanIssue(
  manifest: StoryManifest,
  anchor: QuestionAnchor,
  plan: RoutePlan,
): string | null {
  if (!manifest.speakers.some((speaker) => speaker.id === plan.speakerId)) {
    return 'Route speaker is not registered.';
  }
  if (SIMPLE_ROUTE_KINDS.has(plan.route)) {
    return plan.actionFamilyId ||
      plan.rejoinAt ||
      plan.fallbackFamilyId ||
      plan.options.length > 0
      ? 'Simple route contains branch data.'
      : null;
  }
  if (ACTION_ROUTE_KINDS.has(plan.route)) {
    if (
      !plan.actionFamilyId ||
      !anchor.fallbackFamilyIds.includes(plan.actionFamilyId) ||
      !plan.rejoinAt ||
      !anchor.allowedRejoinAnchorIds.includes(plan.rejoinAt) ||
      !plan.fallbackFamilyId ||
      !anchor.fallbackFamilyIds.includes(plan.fallbackFamilyId) ||
      plan.options.length > 0
    ) {
      return 'Action route contains an invalid family or rejoin.';
    }
    return null;
  }
  if (plan.route !== 'THREE_PATHS') {
    return 'Route kind is not supported.';
  }
  if (
    plan.actionFamilyId ||
    !plan.rejoinAt ||
    !anchor.allowedRejoinAnchorIds.includes(plan.rejoinAt) ||
    !plan.fallbackFamilyId ||
    !anchor.fallbackFamilyIds.includes(plan.fallbackFamilyId) ||
    plan.options.length !== 3
  ) {
    return 'Three-path route shape is invalid.';
  }
  const optionIds = new Set(plan.options.map((option) => option.id));
  const labels = new Set(plan.options.map((option) => option.label));
  const familyIds = new Set(
    plan.options.map((option) => option.actionFamilyId),
  );
  if (
    optionIds.size !== 3 ||
    labels.size !== 3 ||
    familyIds.size !== 3 ||
    plan.options.some(
      (option) => !anchor.fallbackFamilyIds.includes(option.actionFamilyId),
    )
  ) {
    return 'Three-path options are duplicated or not allowed.';
  }
  return null;
}

function normalizeActionRoutePlan(
  manifest: StoryManifest,
  plan: RoutePlan,
): RoutePlan {
  if (!ACTION_ROUTE_KINDS.has(plan.route) || !plan.actionFamilyId) {
    return plan;
  }
  const family = manifest.fallbackFamilies.find(
    (candidate) => candidate.id === plan.actionFamilyId,
  );
  if (!family) {
    return plan;
  }
  return {
    ...plan,
    fallbackFamilyId: family.id,
    rejoinAt: family.rejoinAnchorId,
  };
}

function playScene(
  manifest: StoryManifest,
  scene: StoryScene,
): RuntimeTransition {
  const audioGroupId = scene.audioGroupIds[0];
  if (!audioGroupId) {
    return {
      ok: false,
      state: { status: 'idle', storyId: manifest.storyId },
      failure: {
        code: 'SCENE_WITHOUT_AUDIO',
        stage: 'asset',
        retryable: false,
      },
    };
  }

  return {
    ok: true,
    state: {
      status: 'playing-fixed',
      sceneId: scene.id,
      audioGroupId,
      clipIndex: 0,
    },
    commands: [{ type: 'PLAY_AUDIO', audioGroupId, startClipIndex: 0 }],
  };
}

function nextAfterAudioGroup(
  manifest: StoryManifest,
  scene: StoryScene,
  group: AudioGroup,
  questionRound: number,
): RuntimeTransition {
  const anchor = manifest.questionAnchors.find(
    (candidate) =>
      candidate.sceneId === scene.id &&
      candidate.afterAudioGroupId === group.id,
  );

  if (anchor) {
    return {
      ok: true,
      state: {
        status: 'awaiting-question',
        sceneId: scene.id,
        anchorId: anchor.id,
        questionRound,
      },
      commands: [{ type: 'WAIT_FOR_QUESTION', anchorId: anchor.id }],
    };
  }

  const groupIndex = scene.audioGroupIds.indexOf(group.id);
  const nextAudioGroupId = scene.audioGroupIds[groupIndex + 1];
  if (nextAudioGroupId) {
    return {
      ok: true,
      state: {
        status: 'playing-fixed',
        sceneId: scene.id,
        audioGroupId: nextAudioGroupId,
        clipIndex: 0,
      },
      commands: [
        {
          type: 'PLAY_AUDIO',
          audioGroupId: nextAudioGroupId,
          startClipIndex: 0,
        },
      ],
    };
  }

  if (!scene.nextSceneId) {
    return {
      ok: true,
      state: {
        status: 'complete',
        storyId: manifest.storyId,
        completedSceneId: scene.id,
      },
      commands: [{ type: 'STORY_COMPLETED' }],
    };
  }

  const nextScene = findScene(manifest, scene.nextSceneId);
  if (!nextScene) {
    return {
      ok: false,
      state: {
        status: 'playing-fixed',
        sceneId: scene.id,
        audioGroupId: group.id,
        clipIndex: Math.max(group.clips.length - 1, 0),
      },
      failure: {
        code: 'NEXT_SCENE_NOT_FOUND',
        stage: 'checkpoint',
        retryable: false,
      },
    };
  }

  return playScene(manifest, nextScene);
}

function continueFromAnchor(
  manifest: StoryManifest,
  state: Extract<StoryRuntimeState, { status: 'awaiting-question' }>,
  anchor: QuestionAnchor,
): RuntimeTransition {
  if (anchor.resumeAudioGroupId) {
    return {
      ok: true,
      state: {
        status: 'playing-fixed',
        sceneId: state.sceneId,
        audioGroupId: anchor.resumeAudioGroupId,
        clipIndex: 0,
      },
      commands: [
        {
          type: 'PLAY_AUDIO',
          audioGroupId: anchor.resumeAudioGroupId,
          startClipIndex: 0,
        },
      ],
    };
  }

  const scene = findScene(manifest, state.sceneId);
  if (!scene) {
    return invalidTransition(state, { type: 'CONTINUE_SELECTED' });
  }

  const anchorGroupIndex = scene.audioGroupIds.indexOf(anchor.afterAudioGroupId);
  const nextAudioGroupId = scene.audioGroupIds[anchorGroupIndex + 1];
  if (nextAudioGroupId) {
    return {
      ok: true,
      state: {
        status: 'playing-fixed',
        sceneId: scene.id,
        audioGroupId: nextAudioGroupId,
        clipIndex: 0,
      },
      commands: [
        {
          type: 'PLAY_AUDIO',
          audioGroupId: nextAudioGroupId,
          startClipIndex: 0,
        },
      ],
    };
  }

  const group = findAudioGroup(manifest, anchor.afterAudioGroupId);
  return group
    ? nextAfterAudioGroup(manifest, scene, group, state.questionRound)
    : invalidTransition(state, { type: 'CONTINUE_SELECTED' });
}

export function createInitialRuntimeState(
  manifest: StoryManifest,
): StoryRuntimeState {
  return { status: 'idle', storyId: manifest.storyId };
}

export function transitionStoryRuntime(
  manifest: StoryManifest,
  state: StoryRuntimeState,
  event: StoryRuntimeEvent,
): RuntimeTransition {
  if (state.status === 'idle' && event.type === 'START') {
    const entryScene = findScene(manifest, manifest.entrySceneId);
    return entryScene
      ? playScene(manifest, entryScene)
      : invalidTransition(state, event, 'Entry scene does not exist.');
  }

  if (
    state.status === 'playing-fixed' &&
    event.type === 'SKIP_SCENE_SELECTED'
  ) {
    const scene = findScene(manifest, state.sceneId);
    if (!scene) {
      return invalidTransition(state, event, 'Active scene is missing.');
    }
    if (!scene.nextSceneId) {
      return {
        ok: true,
        state: {
          status: 'complete',
          storyId: manifest.storyId,
          completedSceneId: scene.id,
        },
        commands: [{ type: 'STORY_COMPLETED' }],
      };
    }
    const nextScene = findScene(manifest, scene.nextSceneId);
    return nextScene
      ? playScene(manifest, nextScene)
      : invalidTransition(state, event, 'Next scene does not exist.');
  }

  if (state.status === 'playing-fixed' && event.type === 'AUDIO_ENDED') {
    const scene = findScene(manifest, state.sceneId);
    const group = findAudioGroup(manifest, state.audioGroupId);
    if (!scene || !group) {
      return invalidTransition(state, event, 'Active content is missing.');
    }

    const expectedClip = group.clips[state.clipIndex];
    if (!expectedClip || expectedClip.id !== event.clipId) {
      return invalidTransition(state, event, 'Unexpected audio clip ended.');
    }

    const nextClipIndex = state.clipIndex + 1;
    if (nextClipIndex < group.clips.length) {
      return {
        ok: true,
        state: { ...state, clipIndex: nextClipIndex },
        commands: [
          {
            type: 'PLAY_AUDIO',
            audioGroupId: group.id,
            startClipIndex: nextClipIndex,
          },
        ],
      };
    }

    return nextAfterAudioGroup(manifest, scene, group, 1);
  }

  if (state.status === 'awaiting-choice') {
    const anchor = findAnchor(manifest, state.anchorId);
    if (!anchor) {
      return invalidTransition(state, event, 'Question anchor is missing.');
    }
    if (event.type === 'CONTINUE_SELECTED') {
      return continueFromAnchor(
        manifest,
        {
          status: 'awaiting-question',
          sceneId: state.sceneId,
          anchorId: state.anchorId,
          questionRound: state.questionRound,
        },
        anchor,
      );
    }
    if (event.type === 'CHOICE_SELECTED') {
      const option = state.plan.options.find(
        (candidate) => candidate.id === event.optionId,
      );
      if (
        !option ||
        !anchor.fallbackFamilyIds.includes(option.actionFamilyId)
      ) {
        return invalidTransition(
          state,
          event,
          'Selected option is not allowed.',
        );
      }
      const selectedFamily = manifest.fallbackFamilies.find(
        (family) => family.id === option.actionFamilyId,
      );
      const selectedPlan: RoutePlan = {
        ...state.plan,
        route: 'DIRECT_ACTION',
        originRoute: 'THREE_PATHS',
        selectedOptionId: option.id,
        // branchLine은 이 특정 옵션을 위해 LLM이 작성한 대사이다 (Tier 1 동적 내레이션 참고);
        // family의 정적 acknowledgementText는 그것이 없을 때만 대체용으로 쓰인다.
        text:
          option.branchLine ||
          selectedFamily?.acknowledgementText ||
          '좋아, 우리가 고른 방법으로 조심스럽게 해보자.',
        actionFamilyId: option.actionFamilyId,
        rejoinAt: selectedFamily
          ? selectedFamily.rejoinAnchorId
          : state.plan.rejoinAt,
        options: [],
      };
      return {
        ok: true,
        state: {
          status: 'playing-response',
          sceneId: state.sceneId,
          anchorId: state.anchorId,
          questionRound: state.questionRound,
          plan: selectedPlan,
        },
        commands: [{ type: 'PLAY_RESPONSE', plan: selectedPlan }],
      };
    }
  }

  if (
    state.status === 'awaiting-question' ||
    state.status === 'awaiting-clarification' ||
    state.status === 'recording-question' ||
    state.status === 'processing-question' ||
    (state.status === 'failed-recoverable' && state.anchorId)
  ) {
    const anchor = state.anchorId
      ? findAnchor(manifest, state.anchorId)
      : undefined;
    if (!anchor) {
      return invalidTransition(state, event, 'Question anchor is missing.');
    }

    if (event.type === 'CONTINUE_SELECTED') {
      const waitingState: Extract<
        StoryRuntimeState,
        { status: 'awaiting-question' }
      > = {
        status: 'awaiting-question',
        sceneId: state.sceneId,
        anchorId: anchor.id,
        questionRound: state.questionRound ?? 1,
      };
      return anchor.allowedActions.includes('continue-story')
        ? continueFromAnchor(manifest, waitingState, anchor)
        : invalidTransition(state, event, 'Continue is not allowed.');
    }

    if (event.type === 'ASK_SELECTED' || event.type === 'TYPE_SELECTED') {
      const action = event.type === 'ASK_SELECTED' ? 'ask' : 'type';
      if (!anchor.allowedActions.includes(action)) {
        return invalidTransition(state, event, `${action} is not allowed.`);
      }

      return {
        ok: true,
        state: {
          status: 'recording-question',
          sceneId: state.sceneId,
          anchorId: anchor.id,
          questionRound: state.questionRound ?? 1,
          inputMode: event.type === 'ASK_SELECTED' ? 'voice' : 'text',
        },
        commands:
          event.type === 'ASK_SELECTED'
            ? [{ type: 'REQUEST_RECORDING' }]
            : [],
      };
    }
  }

  if (
    state.status === 'recording-question' &&
    event.type === 'RECORDING_STARTED'
  ) {
    return state.inputMode === 'voice'
      ? { ok: true, state, commands: [] }
      : invalidTransition(state, event, 'Text input cannot start recording.');
  }

  if (
    state.status === 'recording-question' &&
    event.type === 'RECORDING_STOPPED'
  ) {
    if (state.inputMode !== 'voice') {
      return invalidTransition(state, event, 'Text input has no recording.');
    }
    return {
      ok: true,
      state: {
        status: 'processing-question',
        sceneId: state.sceneId,
        anchorId: state.anchorId,
        questionRound: state.questionRound,
        inputMode: state.inputMode,
      },
      commands: [
        { type: 'PROCESS_RECORDING', recording: event.recording },
      ],
    };
  }

  if (
    state.status === 'recording-question' &&
    event.type === 'TEXT_SUBMITTED'
  ) {
    if (state.inputMode !== 'text') {
      return invalidTransition(state, event, 'Voice input cannot submit text.');
    }
    const transcript = event.transcript.trim();
    if (!transcript) {
      return invalidTransition(state, event, 'Text question is empty.');
    }
    return {
      ok: true,
      state: {
        status: 'processing-question',
        sceneId: state.sceneId,
        anchorId: state.anchorId,
        questionRound: state.questionRound,
        inputMode: state.inputMode,
      },
      commands: [{ type: 'PROCESS_TEXT', transcript }],
    };
  }

  if (
    state.status === 'processing-question' &&
    event.type === 'RETRY_QUESTION_SELECTED'
  ) {
    return {
      ok: true,
      state: {
        status: 'recording-question',
        sceneId: state.sceneId,
        anchorId: state.anchorId,
        questionRound: state.questionRound,
        inputMode: state.inputMode,
      },
      commands:
        state.inputMode === 'voice'
          ? [{ type: 'REQUEST_RECORDING' }]
          : [],
    };
  }

  if (
    state.status === 'processing-question' &&
    event.type === 'SPEECH_RESOLVED'
  ) {
    if (event.result.status === 'speech') {
      return { ok: true, state, commands: [] };
    }

    const failure =
      event.result.status === 'failed'
        ? event.result.failure
        : {
            code: `NO_SPEECH_${event.result.reason.toUpperCase().replaceAll('-', '_')}`,
            stage: 'stt' as const,
            retryable: true,
          };
    return {
      ok: true,
      state: {
        status: 'failed-recoverable',
        sceneId: state.sceneId,
        anchorId: state.anchorId,
        questionRound: state.questionRound,
        inputMode: state.inputMode,
        failure,
      },
      commands: [],
    };
  }

  if (
    state.status === 'processing-question' &&
    event.type === 'RESPONSE_READY'
  ) {
    const anchor = findAnchor(manifest, state.anchorId);
    if (!anchor) {
      return invalidTransition(state, event, 'Question anchor is missing.');
    }

    if (event.plan.kind === 'route') {
      const issue = routePlanIssue(manifest, anchor, event.plan);
      if (issue) {
        return invalidTransition(state, event, issue);
      }
      if (event.plan.route === 'THREE_PATHS') {
        return {
          ok: true,
          state: {
            status: 'awaiting-choice',
            sceneId: state.sceneId,
            anchorId: state.anchorId,
            questionRound: state.questionRound,
            plan: event.plan,
          },
          commands: [],
        };
      }
      const normalizedPlan = normalizeActionRoutePlan(manifest, event.plan);
      return {
        ok: true,
        state: {
          status: 'playing-response',
          sceneId: state.sceneId,
          anchorId: state.anchorId,
          questionRound: state.questionRound,
          plan: normalizedPlan,
        },
        commands: [{ type: 'PLAY_RESPONSE', plan: normalizedPlan }],
      };
    }

    if (
      event.plan.kind === 'story-change' &&
      !anchor.allowedRejoinAnchorIds.includes(event.plan.rejoinAt)
    ) {
      return invalidTransition(
        state,
        event,
        'Response rejoin anchor is not allowed.',
      );
    }

    if (
      event.plan.kind === 'fallback' &&
      !anchor.fallbackFamilyIds.includes(event.plan.familyId)
    ) {
      return invalidTransition(
        state,
        event,
        'Fallback family is not allowed.',
      );
    }

    return {
      ok: true,
      state: {
        status: 'playing-response',
        sceneId: state.sceneId,
        anchorId: state.anchorId,
        questionRound: state.questionRound,
        plan: event.plan,
      },
      commands: [{ type: 'PLAY_RESPONSE', plan: event.plan }],
    };
  }

  if (
    state.status === 'playing-response' &&
    event.type === 'RESPONSE_AUDIO_ENDED'
  ) {
    const anchor = findAnchor(manifest, state.anchorId);
    if (!anchor) {
      return invalidTransition(state, event, 'Question anchor is missing.');
    }

    if (state.plan.kind === 'short-answer' && state.plan.resumeAt !== anchor.id) {
      return invalidTransition(
        state,
        event,
        'Short answer resume anchor does not match the active question.',
      );
    }

    if (
      state.plan.kind === 'route' &&
      state.plan.route === 'CLARIFY_ONCE'
    ) {
      return {
        ok: true,
        state: {
          status: 'awaiting-clarification',
          sceneId: state.sceneId,
          anchorId: state.anchorId,
          questionRound: state.questionRound + 1,
          prompt: state.plan.text,
        },
        commands: [],
      };
    }

    const rejoinAnchorId =
      state.plan.kind === 'story-change' ||
      state.plan.kind === 'fallback' ||
      state.plan.kind === 'route'
        ? state.plan.rejoinAt
        : null;
    if (rejoinAnchorId) {
      if (!anchor.allowedRejoinAnchorIds.includes(rejoinAnchorId)) {
        return invalidTransition(
          state,
          event,
          'Response rejoin anchor is not allowed.',
        );
      }

      const rejoin = manifest.rejoinAnchors.find(
        (candidate) => candidate.id === rejoinAnchorId,
      );
      const nextScene = rejoin
        ? findScene(manifest, rejoin.nextSceneId)
        : undefined;
      if (rejoin?.resumeAudioGroupId) {
        const resumeGroup = findAudioGroup(
          manifest,
          rejoin.resumeAudioGroupId,
        );
        if (
          !resumeGroup ||
          !nextScene ||
          resumeGroup.sceneId !== nextScene.id
        ) {
          return invalidTransition(
            state,
            event,
            'Rejoin audio destination is missing.',
          );
        }
        return {
          ok: true,
          state: {
            status: 'playing-fixed',
            sceneId: nextScene.id,
            audioGroupId: resumeGroup.id,
            clipIndex: 0,
          },
          commands: [
            {
              type: 'PLAY_AUDIO',
              audioGroupId: resumeGroup.id,
              startClipIndex: 0,
            },
          ],
        };
      }
      return nextScene
        ? playScene(manifest, nextScene)
        : invalidTransition(state, event, 'Rejoin destination is missing.');
    }

    return continueFromAnchor(
      manifest,
      {
        status: 'awaiting-question',
        sceneId: state.sceneId,
        anchorId: state.anchorId,
        questionRound: state.questionRound + 1,
      },
      anchor,
    );
  }

  if (
    state.status === 'failed-recoverable' &&
    event.type === 'FALLBACK_READY'
  ) {
    if (!state.anchorId) {
      return invalidTransition(
        state,
        event,
        'Failure has no question anchor for a story fallback.',
      );
    }

    const anchor = findAnchor(manifest, state.anchorId);
    if (!anchor || !anchor.fallbackFamilyIds.includes(event.plan.familyId)) {
      return invalidTransition(
        state,
        event,
        'Fallback family is not allowed for the active question.',
      );
    }

    return {
      ok: true,
      state: {
        status: 'playing-response',
        sceneId: state.sceneId,
        anchorId: state.anchorId,
        questionRound: state.questionRound ?? 1,
        plan: event.plan,
      },
      commands: [{ type: 'PLAY_RESPONSE', plan: event.plan }],
    };
  }

  if (event.type === 'FAILURE' && 'sceneId' in state) {
    const anchorId = 'anchorId' in state ? state.anchorId : undefined;
    const questionRound =
      'questionRound' in state ? state.questionRound : undefined;
    const inputMode =
      'inputMode' in state ? state.inputMode : undefined;
    return {
      ok: true,
      state: {
        status: 'failed-recoverable',
        sceneId: state.sceneId,
        anchorId,
        questionRound,
        inputMode,
        failure: event.failure,
      },
      commands: [],
    };
  }

  return invalidTransition(state, event);
}
