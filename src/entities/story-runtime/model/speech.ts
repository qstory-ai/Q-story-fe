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
  /** 이 옵션이 선택된 직후에 말해지는 대사 - selectRouteOption의 내레이션 호출 참고. */
  branchLine: string;
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
  /**
   * 백엔드가 이 질문에 대해 실시간(비동기) 새 분기 생성을 큐에 넣었을 때만 채워진다
   * (LiveBranchGenerationService 참고). 채워져 있으면 이 plan의 다른 필드(옵션/가족 등)는
   * 아직 실제 콘텐츠를 가리키지 않는 "잠깐만 기다려줘" 안내일 뿐이므로, 클라이언트는
   * runtime.ts의 generating-branch 상태로 진입해 GET /v1/live-branch/{jobId}를 폴링한다.
   */
  liveBranchJobId?: string;
  /**
   * 백엔드가 원래 NEW_CHOICES를 고르려 했지만 앵커당 라이브 생성 상한
   * (LiveBranchGenerationService.MAX_LIVE_FAMILIES_PER_ANCHOR)에 걸려 ANSWER_RESUME으로
   * 강등된 경우에만 true. 아이에게 보이는 대사는 다른 이유로 ANSWER_RESUME이 된 경우와
   * 구분되지 않아 UX는 동일하지만, 프런트가 이 플래그를 보고 question_result 이벤트에
   * result='live_branch_capped'로 남겨 운영에서 캡 도달 빈도를 관측할 수 있게 한다.
   */
  liveBranchCapped?: boolean;
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
