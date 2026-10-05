export type QuestionSlot = string;

export type GeneratedVisual = {
  id: string;
  assetId: string;
  mode: string;
  time: string;
  location: string;
  characters: string[];
  entryState: string;
  requiredAction: string;
  exitState: string;
  exception: string | null;
};

export type GeneratedStorySegment =
  | ({ kind: 'visual' } & GeneratedVisual)
  | {
      kind: 'utterance';
      visualId: string | null;
      speaker: string;
      role: string;
      text: string;
    }
  | { kind: 'interaction'; visualId: string | null; slot: QuestionSlot }
  | { kind: 'anchor'; id: string }
  | { kind: 'rejoin'; slot: QuestionSlot; target: string }
  | { kind: 'checkpoint'; id: string }
  | { kind: 'trace'; instruction: string }
  | { kind: 'sfx'; visualId: string | null; id: string };

export type GeneratedStoryScene = {
  id: string;
  title: string;
  visuals: GeneratedVisual[];
  segments: GeneratedStorySegment[];
  questionSlots: QuestionSlot[];
  anchors: string[];
  rejoins: { slot: QuestionSlot; target: string }[];
  checkpointId: string;
};

export type GeneratedFallback = {
  id: string;
  requires: string | null;
  segments: GeneratedStorySegment[];
  rejoin: { slot: QuestionSlot; target: string };
};

export type GeneratedStoryContent = {
  schemaVersion: 1;
  source: { package: string; digest: string };
  story: { id: string; title: string; contentVersion: string };
  scenes: GeneratedStoryScene[];
  fallbacks: GeneratedFallback[];
};

/** One asset row as the backend serves it - see StoryContentAssemblyService. */
/** 질문 초대 도움 - 아이가 요청할 때만 한 단계씩. suggestions는 마지막 단계에서만 보여 주는 방법 예시다. */
export type InviteHelp = {
  steps: string[];
  /** 대화를 마치고 이야기로 돌아갈 때 그레텔이 하는 말(예: 그럼 남매는 어떻게 했는지 이어서 볼까?). */
  continueLine?: string;
  suggestions?: { label: string; familyId: string }[];
};

export type ServedStoryAsset = {
  slug: string;
  category: 'SCENE_ART' | 'BRANCH_ART' | 'NARRATION' | 'BRIDGE';
  url: string;
  integrity: string;
  familyId?: string;
  panel?: number;
};

export type StoryPackageData = {
  schemaVersion: 1;
  /** Absent from packages built before assets were served with the content. */
  assets?: ServedStoryAsset[];
  story: {
    storyId: string;
    slug: string;
    title: string;
    contentVersion: string;
    entrySceneId: string;
    endingSceneId: string;
    /** Q-31: 그레텔 대화가 "지금까지 일어난 일"로 쓰는 장면별 줄거리. */
    sceneSynopses?: Record<string, string>;
    /** Q-31: 질문 초대의 도움 단계(앵커 id별). */
    inviteHelp?: Record<string, InviteHelp>;
  };
  routeContext: {
    routePromptVersion: string;
    routePolicyVersion: string;
    responseTextNormalizationVersion: string;
    anchors: Record<
      string,
      {
        slot: string;
        sceneId: string;
        primarySpeakerId: string;
        allowedSpeakerIds: string[];
        /** 없으면(null) 질문만 하거나 연결이 실패했을 때 기본 이야기로 이어 간다. */
        defaultFallbackFamilyId: string | null;
        defaultRejoinAt: string;
        /** false면 이 질문 지점에서 실시간 새 분기를 만들지 않는다(기본 true). */
        liveBranchGeneration?: boolean;
        actionFamilies: {
          id: string;
          meaning: string;
          acknowledgementText: string;
          reportSummary: string;
          bridgeAudioId: string;
          branchAssetId: string;
          requiresPriorFamilyIds?: string[];
        }[];
      }
    >;
  };
  cast: {
    castVersion: string;
    speakers: Record<
      string,
      {
        speakerId: string;
        role: 'narrator' | 'character';
        displayName: string;
        voice: string;
        profile: string;
        direction: string;
        samePersonKey?: string;
      }
    >;
  };
  reportCopy: StoryReportCopy;
  release: {
    availability: 'INTERNAL' | 'BETA' | 'PUBLISHED' | 'DISABLED';
  };
  sourceDigest: string;
};

export type StoryReportCopy = {
  storyId: string;
  storyTitle: string;
  completedStory: string;
  defaultReportImageAssetId: string;
  noQuestionCuriosityTopic: string;
  noQuestionFocusTopics: string[];
  defaultConversationTopic: string;
  /**
   * 질문이 하나도 없던 회차의 후속 질문 3개 중 가운데 문항 - 이야기 인물에게 건네는 말.
   * 없으면 이야기 제목으로 만든 일반 문장을 쓴다(buildParentReport 참고).
   */
  defaultFollowUpQuestion?: string;
  defaultActivity: { title: string; description: string };
  /**
   * 리포트 "생각 전략" 라벨 - action family id → 전략 이름. 정의돼 있으면 이 표가 유일한 기준이라
   * 표에 없는 family(실시간 생성 family 등)는 전략 집계에서 빠진다. 정의가 없는 이야기는 라우트
   * 종류(DIRECT_ACTION 등)로 전략을 추정한다(report-labels의 STRATEGY_BY_ROUTE).
   */
  strategyByFamily?: Record<string, string>;
  /** 상시 대화 요약 패널의 제목·설명 - 없으면 "이야기 속 인물" 기준의 일반 문구를 쓴다. */
  companionChat?: { title: string; description: string };
  anchors: Record<
    string,
    {
      topic: string;
      focusTopic: string;
      sceneTitle: string;
      reportImageAssetId: string;
      conversationTopic?: string;
      followUpQuestion?: string;
      activity?: { title: string; description: string };
    }
  >;
};
