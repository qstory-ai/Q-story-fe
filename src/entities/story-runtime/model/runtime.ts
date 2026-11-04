import type {
  AudioClipId,
  AudioGroupId,
  FallbackFamilyId,
  QuestionAnchorId,
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
  RoutePlan,
} from './speech';

export type StoryRuntimeState =
  | { status: 'idle'; storyId: StoryId }
  | {
      status: 'playing-fixed';
      sceneId: SceneId;
      audioGroupId: AudioGroupId;
      clipIndex: number;
    }
  | {
      /** 질문 초대 - 아이가 그레텔 대화를 열거나(dialogue.openInvite) 건너뛰기를 고를 때까지 기다린다. */
      status: 'awaiting-question';
      sceneId: SceneId;
      anchorId: QuestionAnchorId;
      questionRound: number;
    }
  | {
      /** 실시간 분기가 준비돼 세 갈래 선택지를 보여 주는 중(LIVE_BRANCH_READY 뒤). */
      status: 'awaiting-choice';
      sceneId: SceneId;
      anchorId: QuestionAnchorId;
      questionRound: number;
      plan: RoutePlan;
    }
  | {
      /**
       * 그레텔 대화에서 새 선택지 생성을 요청했을 때(plan.liveBranchJobId) 진입하는 상태. jobId는
       * GET /v1/live-branch/{jobId} 폴링에, plan은 "잠깐만 기다려줘" 안내 문구/화자 등 원본 컨텍스트
       * 보관용으로 쓰인다(use-live-branch-polling.ts). LIVE_BRANCH_READY/LIVE_BRANCH_FAILED로만 빠져나간다.
       */
      status: 'generating-branch';
      sceneId: SceneId;
      anchorId: QuestionAnchorId;
      questionRound: number;
      jobId: string;
      plan: RoutePlan;
    }
  | {
      status: 'playing-response';
      sceneId: SceneId;
      anchorId: QuestionAnchorId;
      questionRound: number;
      plan: RoutePlan;
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
  | { type: 'CONTINUE_SELECTED' }
  /** 질문 초대 대화에서 아이가 뜻을 확인한 행동을 실행한다(Q-31) - plan은 DIRECT_ACTION route여야 한다. */
  | { type: 'ACTION_CONFIRMED'; plan: RoutePlan }
  /** 그레텔 대화에서 아이의 새 계획으로 실시간 분기를 요청했다(plan.liveBranchJobId) - 바로 generating-branch로. */
  | { type: 'LIVE_BRANCH_REQUESTED'; plan: RoutePlan }
  | {
      type: 'CHOICE_SELECTED';
      optionId: 'OPTION_1' | 'OPTION_2' | 'OPTION_3';
    }
  | { type: 'RESPONSE_AUDIO_ENDED' }
  /** GET /v1/live-branch/{jobId} 폴링이 READY를 봤고, 콘텐츠 재조회까지 끝난 뒤에 보낸다.
   *  항상 정확히 3개(새로 생성된 것 + 모자란 자리를 채운 기존 family)이며, 각 familyId는
   *  재조회된 manifest.fallbackFamilies 안에 반드시 존재해야 한다. */
  | { type: 'LIVE_BRANCH_READY'; options: readonly LiveBranchReadyOption[] }
  /** 폴링이 FAILED 상태를 봤거나, 클라이언트 쪽 폴링 타임아웃에 걸렸을 때 보낸다. */
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
  | { type: 'PLAY_RESPONSE'; plan: RoutePlan }
  | { type: 'SAVE_CHECKPOINT'; checkpoint: StoryCheckpoint }
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
      // 기본 분기가 없는 질문 지점에서는 서버가 fallbackFamilyId를 비워 보낼 수 있다 -
      // normalizeActionRoutePlan이 실행할 family로 채운다.
      (plan.fallbackFamilyId !== null &&
        !anchor.fallbackFamilyIds.includes(plan.fallbackFamilyId)) ||
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

/**
 * 챕터 사이드바에서 지난 장면으로 "진짜 되감기"할 때 쓴다 - transitionStoryRuntime()의 이벤트
 * 기반 전이를 거치지 않고, START 이벤트가 entrySceneId에 대해 하는 것과 똑같이 playScene()으로
 * 그 장면의 시작 상태(playing-fixed, clipIndex 0)를 직접 만든다. 질문/분기를 거쳐야만 도달하는
 * 상태(awaiting-choice 등)로는 못 만든다 - scenes 배열의 모든 장면이 kind:'fixed'라 각 장면의
 * "시작점" 자체는 분기와 무관하게 항상 존재한다.
 */
export function jumpToScene(
  manifest: StoryManifest,
  sceneId: SceneId,
): RuntimeTransition {
  const scene = findScene(manifest, sceneId);
  if (!scene) {
    return {
      ok: false,
      state: { status: 'idle', storyId: manifest.storyId },
      failure: { code: 'SCENE_NOT_FOUND', stage: 'asset', retryable: false },
    };
  }
  return playScene(manifest, scene);
}

function transitionFromIdle(
  manifest: StoryManifest,
  state: StoryRuntimeState,
  event: StoryRuntimeEvent,
): RuntimeTransition | undefined {
  if (state.status === 'idle' && event.type === 'START') {
    const entryScene = findScene(manifest, manifest.entrySceneId);
    return entryScene
      ? playScene(manifest, entryScene)
      : invalidTransition(state, event, 'Entry scene does not exist.');
  }
  return undefined;
}

function transitionFromPlayingFixed(
  manifest: StoryManifest,
  state: StoryRuntimeState,
  event: StoryRuntimeEvent,
): RuntimeTransition | undefined {
  if (state.status !== 'playing-fixed') return undefined;

  if (event.type === 'SKIP_SCENE_SELECTED') {
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

  if (event.type === 'AUDIO_ENDED') {
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

  return undefined;
}

function transitionFromAwaitingChoice(
  manifest: StoryManifest,
  state: StoryRuntimeState,
  event: StoryRuntimeEvent,
): RuntimeTransition | undefined {
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
  return undefined;
}

function transitionFromGeneratingBranch(
  manifest: StoryManifest,
  state: StoryRuntimeState,
  event: StoryRuntimeEvent,
): RuntimeTransition | undefined {
  if (state.status === 'generating-branch') {
    if (event.type === 'LIVE_BRANCH_READY') {
      // 백엔드가 만든(부족하면 기존 family로 채운) 정확히 3개를 아이가 직접 고르는 정상적인
      // THREE_PATHS 흐름으로 넘긴다.
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
        // 기본 분기가 없는 질문 지점(HG-Q-C 열쇠 장면 등)은 defaultFallbackFamilyId가 null이다.
        // 그대로 두면 THREE_PATHS 검증에서 막혀 '만드는 중' 화면에 갇힌다(10/31). 첫 옵션으로 채운다.
        fallbackFamilyId: anchor.defaultFallbackFamilyId ?? event.options[0].familyId,
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
          plan: threePathsPlan,
        },
        commands: [],
      };
    }

    if (event.type === 'LIVE_BRANCH_FAILED') {
      // 생성 실패/타임아웃 - 사람 승인 없이 노출할 콘텐츠가 없으므로 짧은 안내(GENTLE_REDIRECT)를 들려준 뒤
      // RESPONSE_AUDIO_ENDED의 "rejoinAt이 없으면 continueFromAnchor" 분기로 이야기를 안전하게 이어간다.
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
          plan: gentlePlan,
        },
        commands: [{ type: 'PLAY_RESPONSE', plan: gentlePlan }],
      };
    }
  }
  return undefined;
}

/** 질문 초대(awaiting-question)에서 아이가 고를 수 있는 것 - 건너뛰기, 대화에서 확인한 행동 실행, 새 선택지 생성 요청. */
function transitionFromAwaitingQuestion(
  manifest: StoryManifest,
  state: StoryRuntimeState,
  event: StoryRuntimeEvent,
): RuntimeTransition | undefined {
  if (state.status !== 'awaiting-question') return undefined;
  const anchor = findAnchor(manifest, state.anchorId);
  if (!anchor) {
    return invalidTransition(state, event, 'Question anchor is missing.');
  }

  if (event.type === 'CONTINUE_SELECTED') {
    return anchor.allowedActions.includes('continue-story')
      ? continueFromAnchor(manifest, state, anchor)
      : invalidTransition(state, event, 'Continue is not allowed.');
  }

  if (event.type === 'LIVE_BRANCH_REQUESTED') {
    if (!event.plan.liveBranchJobId) {
      return invalidTransition(state, event, 'A live branch needs a job id.');
    }
    return {
      ok: true,
      state: {
        status: 'generating-branch',
        sceneId: state.sceneId,
        anchorId: anchor.id,
        questionRound: state.questionRound,
        jobId: event.plan.liveBranchJobId,
        plan: event.plan,
      },
      commands: [],
    };
  }

  if (event.type === 'ACTION_CONFIRMED') {
    if (event.plan.route !== 'DIRECT_ACTION') {
      return invalidTransition(state, event, 'Only a confirmed action can run from the dialogue.');
    }
    const issue = routePlanIssue(manifest, anchor, event.plan);
    if (issue) {
      return invalidTransition(state, event, issue);
    }
    const plan = normalizeActionRoutePlan(manifest, event.plan);
    return {
      ok: true,
      state: {
        status: 'playing-response',
        sceneId: state.sceneId,
        anchorId: anchor.id,
        questionRound: state.questionRound,
        plan,
      },
      commands: [{ type: 'PLAY_RESPONSE', plan }],
    };
  }
  return undefined;
}

function transitionFromPlayingResponse(
  manifest: StoryManifest,
  state: StoryRuntimeState,
  event: StoryRuntimeEvent,
): RuntimeTransition | undefined {
  if (
    state.status === 'playing-response' &&
    event.type === 'RESPONSE_AUDIO_ENDED'
  ) {
    const anchor = findAnchor(manifest, state.anchorId);
    if (!anchor) {
      return invalidTransition(state, event, 'Question anchor is missing.');
    }

    const rejoinAnchorId = state.plan.rejoinAt;
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

    // 합류 지점이 없는 답(실시간 분기 실패 안내 등)은 질문 지점 다음 대사부터 이어 간다.
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

  return undefined;
}

export function transitionStoryRuntime(
  manifest: StoryManifest,
  state: StoryRuntimeState,
  event: StoryRuntimeEvent,
): RuntimeTransition {
  return (
    transitionFromIdle(manifest, state, event) ??
    transitionFromPlayingFixed(manifest, state, event) ??
    transitionFromAwaitingChoice(manifest, state, event) ??
    transitionFromGeneratingBranch(manifest, state, event) ??
    transitionFromAwaitingQuestion(manifest, state, event) ??
    transitionFromPlayingResponse(manifest, state, event) ??
    invalidTransition(state, event)
  );
}
