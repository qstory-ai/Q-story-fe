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
      /** questionRound과 같은 방식으로 클라이언트가 무상태로 들고 다니는, 안전게이트가
       * 연속으로 GENTLE_REDIRECT를 반환한 횟수 (§2 안전게이트 3회 연속 실패 참고). */
      consecutiveSafetyFailures: number;
    }
  | {
      status: 'recording-question';
      sceneId: SceneId;
      anchorId: QuestionAnchorId;
      questionRound: number;
      consecutiveSafetyFailures: number;
      inputMode: QuestionInputMode;
    }
  | {
      status: 'awaiting-choice';
      sceneId: SceneId;
      anchorId: QuestionAnchorId;
      questionRound: number;
      consecutiveSafetyFailures: number;
      plan: RoutePlan;
    }
  | {
      status: 'awaiting-clarification';
      sceneId: SceneId;
      anchorId: QuestionAnchorId;
      questionRound: number;
      consecutiveSafetyFailures: number;
      prompt: string;
    }
  | {
      /**
       * 안전게이트가 REDIRECT를 반환했지만 아직 3회 연속(consecutiveSafetyFailures+1 < 3)에
       * 못 미쳤을 때 진입하는 상태 - awaiting-clarification과 완전히 같은 모양이며(재질문
       * UI 재사용), question-invite-panel.tsx의 기존 삼항 분기에 케이스만 추가되어 있다.
       * ASK_SELECTED/TYPE_SELECTED로 재질문을 받거나 CONTINUE_SELECTED로 건너뛸 수 있다.
       */
      status: 'awaiting-safety-retry';
      sceneId: SceneId;
      anchorId: QuestionAnchorId;
      questionRound: number;
      consecutiveSafetyFailures: number;
      prompt: string;
    }
  | {
      status: 'processing-question';
      sceneId: SceneId;
      anchorId: QuestionAnchorId;
      questionRound: number;
      consecutiveSafetyFailures: number;
      inputMode: QuestionInputMode;
    }
  | {
      /**
       * 백엔드가 이 질문에 실시간 새 분기 생성을 큐에 넣었을 때(plan.liveBranchJobId)
       * 진입하는 상태. jobId는 GET /v1/live-branch/{jobId} 폴링에, plan은 "잠깐만
       * 기다려줘" 안내 문구/화자 등 원본 컨텍스트 보관용으로 쓰인다(사용법: use-one-story
       * -runtime.ts의 폴링 effect). LIVE_BRANCH_READY/LIVE_BRANCH_FAILED로만 빠져나간다.
       */
      status: 'generating-branch';
      sceneId: SceneId;
      anchorId: QuestionAnchorId;
      questionRound: number;
      consecutiveSafetyFailures: number;
      jobId: string;
      plan: RoutePlan;
    }
  | {
      status: 'playing-response';
      sceneId: SceneId;
      anchorId: QuestionAnchorId;
      questionRound: number;
      consecutiveSafetyFailures: number;
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
      consecutiveSafetyFailures?: number;
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
  | { type: 'FALLBACK_READY'; plan: FallbackPlan }
  /** GET /v1/live-branch/{jobId} 폴링이 READY를 봤고, 콘텐츠 재조회까지 끝난 뒤에 보낸다.
   *  Phase 2부터는 항상 정확히 3개(새로 생성된 것 + 모자란 자리를 채운 기존 family)이며,
   *  각 familyId는 재조회된 manifest.fallbackFamilies 안에 반드시 존재해야 한다. */
  | { type: 'LIVE_BRANCH_READY'; options: readonly LiveBranchReadyOption[] }
  /** 폴링이 FAILED 상태를 봤거나, 클라이언트 쪽 60초 타임아웃에 걸렸을 때 보낸다. */
  | { type: 'LIVE_BRANCH_FAILED' };

/** GET /v1/live-branch/{jobId}가 READY일 때 돌려주는 옵션 하나 - THREE_PATHS의 RouteOption과
 * 달리 branchLine이 없다(백엔드가 선택 시점이 아니라 생성 시점에 한 번만 만들기 때문). */
export type LiveBranchReadyOption = {
  familyId: FallbackFamilyId;
  label: string;
  meaning: string;
};

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
        // 새로운 앵커에 처음 도달한 것이므로 항상 0으로 리셋한다 - 이전 앵커에서의 안전게이트
        // 연속 실패는 여기까지 이어지지 않는다 (§2, continueFromAnchor/nextAfterAudioGroup이
        // 새 awaiting-question을 만드는 지점에서는 항상 리셋).
        consecutiveSafetyFailures: 0,
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
          consecutiveSafetyFailures: state.consecutiveSafetyFailures,
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
          consecutiveSafetyFailures: state.consecutiveSafetyFailures,
          plan: selectedPlan,
        },
        commands: [{ type: 'PLAY_RESPONSE', plan: selectedPlan }],
      };
    }
  }

  if (state.status === 'generating-branch') {
    if (event.type === 'LIVE_BRANCH_READY') {
      // Phase 2: 더 이상 family 1개를 자동재생하지 않는다 - 백엔드가 만든(부족하면 기존
      // family로 채운) 정확히 3개를 아이가 직접 고르는 정상적인 THREE_PATHS 흐름으로 넘긴다.
      // 호출부(use-one-story-runtime.ts)가 이 이벤트를 보내기 전에
      // GET /v1/stories/{storyId}/content를 재조회해 manifest를 이미 갈아끼웠다고
      // 가정하므로, 모든 family는 여기서 찾아져야 한다. 이후로는 아이가 방금 세 갈래
      // 선택지를 마주한 것과 완전히 동일하게 취급되어(selectRouteOption 참고) 새로운
      // 선택/재생 UI가 필요 없다.
      const anchor = findAnchor(manifest, state.anchorId);
      if (!anchor) {
        return invalidTransition(state, event, 'Question anchor is missing.');
      }
      if (
        event.options.length !== 3 ||
        event.options.some(
          (option) =>
            !manifest.fallbackFamilies.some(
              (family) => family.id === option.familyId,
            ),
        )
      ) {
        return invalidTransition(
          state,
          event,
          'Live-generated options were not found after refetching story content.',
        );
      }
      const optionIds = ['OPTION_1', 'OPTION_2', 'OPTION_3'] as const;
      const threePathsPlan: RoutePlan = {
        ...state.plan,
        route: 'THREE_PATHS',
        liveBranchJobId: undefined,
        actionFamilyId: null,
        // THREE_PATHS의 rejoinAt/fallbackFamilyId는 옵션 각각의 실제 rejoin이 아니라
        // 검증용 기본값이다(선택 시 실제 rejoin은 selectedFamily.rejoinAnchorId를 그대로
        // 쓴다 - CHOICE_SELECTED 처리 참고) - 서버가 내려주는 일반 THREE_PATHS plan과
        // 동일한 규칙.
        rejoinAt: anchor.allowedRejoinAnchorIds[0] ?? null,
        fallbackFamilyId: anchor.defaultFallbackFamilyId,
        text: '어떤 방법으로 더 알아볼지 골라볼까?',
        options: event.options.map((option, index) => ({
          id: optionIds[index],
          label: option.label,
          meaning: option.meaning,
          actionFamilyId: option.familyId,
          // 백엔드가 선택 시점이 아니라 생성 시점에 한 번만 대사를 만들기 때문에 비워 둔다 -
          // CHOICE_SELECTED가 이미 selectedFamily.acknowledgementText로 대체하는 경로를 탄다.
          branchLine: '',
        })),
      };
      const issue = routePlanIssue(manifest, anchor, threePathsPlan);
      if (issue) {
        return invalidTransition(state, event, issue);
      }
      return {
        ok: true,
        state: {
          status: 'awaiting-choice',
          sceneId: state.sceneId,
          anchorId: state.anchorId,
          questionRound: state.questionRound,
          consecutiveSafetyFailures: state.consecutiveSafetyFailures,
          plan: threePathsPlan,
        },
        commands: [],
      };
    }

    if (event.type === 'LIVE_BRANCH_FAILED') {
      // 생성 실패/타임아웃 - 사람 승인 없이 노출할 콘텐츠가 없으므로, 이미 있는
      // GENTLE_REDIRECT 처리(간단한 안내 후 continueFromAnchor로 이어짐, RESPONSE_AUDIO_ENDED
      // 처리부의 "rejoinAnchorId가 없으면 계속 진행" 분기 참고)를 그대로 재사용해 이야기를
      // 안전하게 이어간다.
      const gentlePlan: RoutePlan = {
        ...state.plan,
        route: 'GENTLE_REDIRECT',
        liveBranchJobId: undefined,
        actionFamilyId: null,
        rejoinAt: null,
        fallbackFamilyId: null,
        options: [],
        text: '미안해, 지금은 그건 알아보지 못했어. 대신 이야기를 계속 들려줄게.',
      };
      return {
        ok: true,
        state: {
          status: 'playing-response',
          sceneId: state.sceneId,
          anchorId: state.anchorId,
          questionRound: state.questionRound,
          // 안전게이트가 실제로 거부한 게 아니라 실시간 생성 자체가 실패한 것이므로 §2의
          // 3회 연속 카운트에는 포함되지 않아야 한다 - 아래 RESPONSE_AUDIO_ENDED의
          // GENTLE_REDIRECT 분기가 재질문 없이 곧장 continueFromAnchor로 넘어가도록 카운터를
          // 일부러 임계값(3)에 못박아 둔다.
          consecutiveSafetyFailures: 3,
          plan: gentlePlan,
        },
        commands: [{ type: 'PLAY_RESPONSE', plan: gentlePlan }],
      };
    }
  }

  if (
    state.status === 'awaiting-question' ||
    state.status === 'awaiting-clarification' ||
    state.status === 'awaiting-safety-retry' ||
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
        consecutiveSafetyFailures: state.consecutiveSafetyFailures ?? 0,
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
          consecutiveSafetyFailures: state.consecutiveSafetyFailures ?? 0,
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
        consecutiveSafetyFailures: state.consecutiveSafetyFailures,
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
        consecutiveSafetyFailures: state.consecutiveSafetyFailures,
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
        consecutiveSafetyFailures: state.consecutiveSafetyFailures,
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
        consecutiveSafetyFailures: state.consecutiveSafetyFailures,
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
      // 실시간 새 분기 생성이 백그라운드로 큐에 들어간 응답이다 - 아직 실제 콘텐츠를 가리키지
      // 않으므로 THREE_PATHS 정규화나 routePlanIssue 검증(예: SIMPLE_ROUTE_KINDS는 옵션이
      // 비어 있어야 한다는 등)보다 먼저 분기해, 이 임시 plan이 그 검증들을 통과하는지 여부와
      // 무관하게 항상 generating-branch로 들어간다.
      if (event.plan.liveBranchJobId) {
        return {
          ok: true,
          state: {
            status: 'generating-branch',
            sceneId: state.sceneId,
            anchorId: state.anchorId,
            questionRound: state.questionRound,
            consecutiveSafetyFailures: state.consecutiveSafetyFailures,
            jobId: event.plan.liveBranchJobId,
            plan: event.plan,
          },
          commands: [],
        };
      }
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
            consecutiveSafetyFailures: state.consecutiveSafetyFailures,
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
          consecutiveSafetyFailures: state.consecutiveSafetyFailures,
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
        consecutiveSafetyFailures: state.consecutiveSafetyFailures,
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
          // CLARIFY_ONCE는 안전게이트와 무관한 별개의 재질문 경로이므로 카운터를 그대로
          // 이어간다(늘리지도, 리셋하지도 않는다).
          consecutiveSafetyFailures: state.consecutiveSafetyFailures,
          prompt: state.plan.text,
        },
        commands: [],
      };
    }

    if (
      state.plan.kind === 'route' &&
      state.plan.route === 'GENTLE_REDIRECT'
    ) {
      // §2 안전게이트 3회 연속 실패: questionRound와 완전히 같은 방식으로 클라이언트가
      // 무상태로 들고 다니는 카운터다. 3회 미만이면 재질문 UI(awaiting-safety-retry)를 다시
      // 띄우고, 3회째에 도달하면 더 묻지 않고 기존 GENTLE_REDIRECT의 fallthrough를 그대로
      // 호출해 이야기를 이어간다(카운터는 새 사이클이므로 리셋).
      if (state.consecutiveSafetyFailures + 1 < 3) {
        return {
          ok: true,
          state: {
            status: 'awaiting-safety-retry',
            sceneId: state.sceneId,
            anchorId: state.anchorId,
            questionRound: state.questionRound + 1,
            consecutiveSafetyFailures: state.consecutiveSafetyFailures + 1,
            prompt: state.plan.text,
          },
          commands: [],
        };
      }
      return continueFromAnchor(
        manifest,
        {
          status: 'awaiting-question',
          sceneId: state.sceneId,
          anchorId: state.anchorId,
          questionRound: state.questionRound + 1,
          consecutiveSafetyFailures: 0,
        },
        anchor,
      );
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
        consecutiveSafetyFailures: 0,
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
        consecutiveSafetyFailures: state.consecutiveSafetyFailures ?? 0,
        plan: event.plan,
      },
      commands: [{ type: 'PLAY_RESPONSE', plan: event.plan }],
    };
  }

  if (event.type === 'FAILURE' && 'sceneId' in state) {
    const anchorId = 'anchorId' in state ? state.anchorId : undefined;
    const questionRound =
      'questionRound' in state ? state.questionRound : undefined;
    const consecutiveSafetyFailures =
      'consecutiveSafetyFailures' in state
        ? state.consecutiveSafetyFailures
        : undefined;
    const inputMode =
      'inputMode' in state ? state.inputMode : undefined;
    return {
      ok: true,
      state: {
        status: 'failed-recoverable',
        sceneId: state.sceneId,
        anchorId,
        questionRound,
        consecutiveSafetyFailures,
        inputMode,
        failure: event.failure,
      },
      commands: [],
    };
  }

  return invalidTransition(state, event);
}
