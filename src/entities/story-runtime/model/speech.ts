import type {
  FallbackFamilyId,
  QuestionAnchorId,
  RecordingAssetId,
  RejoinAnchorId,
  SpeakerId,
} from './ids';
import type { PriorTrace, StoryStateSnapshot } from './content';

export type LocalRecordingArtifact = {
  uri: string;
  durationMillis: number;
  mimeType: string;
  byteSize?: number;
  peakMeteringDb?: number;
};

export type RecordingAsset = LocalRecordingArtifact & {
  id: RecordingAssetId;
  storage: 'ephemeral-device' | 'temporary-server';
  createdAt: string;
};

export type FailureStage =
  | 'permission'
  | 'recording'
  | 'upload'
  | 'normalization'
  | 'stt'
  | 'routing'
  | 'response'
  | 'tts'
  | 'asset'
  | 'checkpoint';

export type FailureReason = {
  code: string;
  stage: FailureStage;
  retryable: boolean;
  safeDetail?: string;
};

export type SpeechResult =
  | {
      status: 'speech';
      transcript: string;
      locale: string;
      confidence?: number;
      normalizedMimeType: string;
    }
  | {
      status: 'no-speech';
      reason: 'empty-file' | 'silence' | 'too-short' | 'unintelligible';
    }
  | {
      status: 'failed';
      failure: FailureReason;
    };

export type ShortAnswerPlan = {
  kind: 'short-answer';
  text: string;
  resumeAt: QuestionAnchorId;
};

export type StoryChangePlan = {
  kind: 'story-change';
  childRelevantMeaning: string;
  text: string;
  requiredStateChange: StoryStateSnapshot;
  rejoinAt: RejoinAnchorId;
  fallbackFamilyId: FallbackFamilyId;
  trace: PriorTrace | null;
};

export type FallbackPlan = {
  kind: 'fallback';
  familyId: FallbackFamilyId;
  text: string;
  rejoinAt: RejoinAnchorId | null;
};

export type RouteKind =
  | 'ANSWER_RESUME'
  | 'DIRECT_ACTION'
  | 'THREE_PATHS'
  | 'SCENE_REPLACE'
  | 'DETOUR_REJOIN'
  | 'CLARIFY_ONCE'
  | 'GENTLE_REDIRECT'
  | 'SKIP_CONTINUE';

export type RouteOption = {
  id: 'OPTION_1' | 'OPTION_2' | 'OPTION_3';
  label: string;
  meaning: string;
  actionFamilyId: FallbackFamilyId;
};

export type RoutePlan = {
  kind: 'route';
  route: RouteKind;
  childRelevantMeaning: string;
  coverageStatus: 'exact' | 'partial' | 'uncovered';
  coverageReason: string;
  text: string;
  speakerId: SpeakerId;
  actionFamilyId: FallbackFamilyId | null;
  rejoinAt: RejoinAnchorId | null;
  fallbackFamilyId: FallbackFamilyId | null;
  options: RouteOption[];
  originRoute?: 'THREE_PATHS';
  selectedOptionId?: RouteOption['id'];
  versions: {
    modelId: string;
    promptVersion: string;
    storyManifestVersion: string;
    routePolicyVersion: string;
    responseTextNormalizationVersion?: string;
  };
};

export type ResponsePlan =
  | ShortAnswerPlan
  | StoryChangePlan
  | FallbackPlan
  | RoutePlan;
