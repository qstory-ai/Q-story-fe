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
        defaultFallbackFamilyId: string;
        defaultRejoinAt: string;
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
  defaultFollowUpQuestion: string;
  defaultActivity: { title: string; description: string };
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
