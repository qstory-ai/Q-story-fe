import type {
  AssetId,
  AudioClipId,
  AudioGroupId,
  FallbackFamilyId,
  QuestionAnchorId,
  RejoinAnchorId,
  SceneId,
  SpeakerId,
  StoryId,
  TraceId,
  VisualStateId,
} from './ids';

export type StoryStateValue = boolean | number | string;
export type StoryStateSnapshot = Readonly<Record<string, StoryStateValue>>;

export type ContentAsset = {
  id: AssetId;
  kind: 'image' | 'audio';
  uri: string;
  integrity?: string;
};

export type Speaker = {
  id: SpeakerId;
  role: 'narrator' | 'character';
  displayName: string;
};

export type VisualState = {
  id: VisualStateId;
  sceneId: SceneId;
  masterAssetId: AssetId;
  layerAssetIds: readonly AssetId[];
  order: number;
};

export type AudioClip = {
  id: AudioClipId;
  assetId: AssetId;
  speakerId: SpeakerId;
  transcript: string;
  order: number;
};

export type AudioGroup = {
  id: AudioGroupId;
  sceneId: SceneId;
  visualStateId: VisualStateId;
  clips: readonly AudioClip[];
};

export type QuestionAction = 'ask' | 'type' | 'continue-story';
export type QuestionInteractionMode = 'curiosity';
export type QuestionInputKind = 'question' | 'guess' | 'warning' | 'plan';

export type QuestionAnchor = {
  id: QuestionAnchorId;
  sceneId: SceneId;
  afterAudioGroupId: AudioGroupId;
  prompt: string;
  promptSpeakerId: SpeakerId;
  interactionMode: QuestionInteractionMode;
  acceptedInputKinds: readonly QuestionInputKind[];
  allowedActions: readonly QuestionAction[];
  resumeAudioGroupId: AudioGroupId | null;
  allowedRejoinAnchorIds: readonly RejoinAnchorId[];
  fallbackFamilyIds: readonly FallbackFamilyId[];
  defaultFallbackFamilyId: FallbackFamilyId;
};

export type RejoinAnchor = {
  id: RejoinAnchorId;
  sceneId: SceneId;
  nextSceneId: SceneId;
  resumeAudioGroupId?: AudioGroupId;
  requiredState: StoryStateSnapshot;
};

export type FallbackFamily = {
  id: FallbackFamilyId;
  meaning: string;
  acknowledgementText?: string;
  bridgeAudioId?: string | null;
  branchAssetId?: AssetId | null;
  audioGroupId: AudioGroupId;
  rejoinAnchorId: RejoinAnchorId | null;
};

export type StoryScene = {
  id: SceneId;
  sequence: number;
  kind: 'fixed';
  entryState: StoryStateSnapshot;
  requiredExitState: StoryStateSnapshot;
  visualStateIds: readonly VisualStateId[];
  audioGroupIds: readonly AudioGroupId[];
  questionAnchorIds: readonly QuestionAnchorId[];
  nextSceneId: SceneId | null;
  checkpoint: true;
};

export type StoryManifest = {
  schemaVersion: 1;
  storyId: StoryId;
  contentVersion: string;
  title: string;
  entrySceneId: SceneId;
  endingSceneId: SceneId;
  scenes: readonly StoryScene[];
  visualStates: readonly VisualState[];
  audioGroups: readonly AudioGroup[];
  assets: readonly ContentAsset[];
  speakers: readonly Speaker[];
  questionAnchors: readonly QuestionAnchor[];
  rejoinAnchors: readonly RejoinAnchor[];
  fallbackFamilies: readonly FallbackFamily[];
};

export type PriorTrace = {
  id: TraceId;
  kind: 'ALLY' | 'SIGNAL' | 'KNOWLEDGE' | 'ROUTE_MARK';
  summary: string;
  sourceSceneId: SceneId;
};

export type StoryCheckpoint = {
  schemaVersion: 1;
  storyId: StoryId;
  contentVersion: string;
  completedSceneId: SceneId | null;
  nextSceneId: SceneId;
  priorTrace: PriorTrace | null;
  questionRound: number;
  savedAt: string;
};
