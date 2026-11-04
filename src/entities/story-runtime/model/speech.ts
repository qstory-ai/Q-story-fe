import type { FallbackFamilyId, RejoinAnchorId, SpeakerId } from './ids';

export type LocalRecordingArtifact = {
  uri: string;
  durationMillis: number;
  mimeType: string;
  byteSize?: number;
  peakMeteringDb?: number;
};

export type FailureStage = 'asset' | 'checkpoint';

export type FailureReason = {
  code: string;
  stage: FailureStage;
  retryable: boolean;
  safeDetail?: string;
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
  /** 이 옵션이 선택된 직후에 말해지는 대사. 실시간 분기 선택지는 비워 두고 family의 확인 문구를 쓴다. */
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
   * 그레텔 대화에서 새 선택지 생성을 요청했을 때(POST /v1/live-branch) 받은 작업 id. 채워져 있으면 이 plan의
   * 다른 필드는 아직 실제 콘텐츠를 가리키지 않는 "잠깐만 기다려줘" 안내일 뿐이므로, 클라이언트는
   * runtime.ts의 generating-branch 상태로 진입해 GET /v1/live-branch/{jobId}를 폴링한다.
   */
  liveBranchJobId?: string;
  versions: {
    modelId: string;
    promptVersion: string;
    storyManifestVersion: string;
    routePolicyVersion: string;
    responseTextNormalizationVersion?: string;
  };
};
