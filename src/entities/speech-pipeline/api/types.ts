import type {
  FailureReason,
  FallbackPlan,
  LocalRecordingArtifact,
  QuestionAnchorId,
  ResponsePlan,
  SceneId,
  SpeechResult,
  StoryId,
} from '@/entities/story-runtime';

export type SpeechPipelineInput = {
  recording: LocalRecordingArtifact;
  /** 이미 캡처된 웹 오디오. 임시 blob URL을 다시 읽지 않기 위함이다. */
  recordingData?: Blob;
  storyId: StoryId;
  sceneId: SceneId;
  anchorId: QuestionAnchorId;
  questionRound: number;
};

export type TextQuestionPipelineInput = Omit<
  SpeechPipelineInput,
  'recording' | 'recordingData'
> & {
  transcript: string;
  /** 아직 한 번도 경험하지 못했다면 베타 라우터가 실제 선택지를 하나 노출하도록 요청한다. */
  guaranteeAgencyChoice?: boolean;
  /** 이번 스토리 세션에서 이미 앞서 경험한 family들. */
  priorActionFamilyIds?: string[];
  /**
   * questionRound와 같은 방식으로 클라이언트가 무상태로 들고 다니는, 안전게이트가 연속으로
   * REDIRECT를 반환한 횟수(entities/story-runtime StoryRuntimeState.consecutiveSafetyFailures
   * 참고). 백엔드의 안전게이트 stage가 아직 이 필드를 소비하지 않더라도, 계약대로 항상 실어
   * 보낸다.
   */
  consecutiveSafetyFailures?: number;
};

export type SpeechPipelineSuccess = {
  ok: true;
  speech: Extract<SpeechResult, { status: 'speech' }>;
  plan: ResponsePlan;
  audioText: string;
  diagnostics?: SpeechPipelineDiagnostics;
  audio?: {
    mimeType: string;
    dataBase64: string;
  };
};

export type SpeechPipelineFallback = {
  ok: false;
  failure: FailureReason;
  fallback: FallbackPlan;
};

export type SpeechPipelineOutput =
  | SpeechPipelineSuccess
  | SpeechPipelineFallback;

export type TranscriptionSuccess = {
  ok: true;
  speech: Extract<SpeechResult, { status: 'speech' }>;
  diagnostics?: SpeechPipelineDiagnostics;
};

export type SpeechPipelineDiagnostics = {
  sttMs?: number;
  responseMs?: number;
  ttsMs?: number;
  totalMs?: number;
  responseAttempts?: number;
  ttsStatus?: string;
  ttsFailureCode?: string | null;
};

export type TranscriptionOutput =
  | TranscriptionSuccess
  | SpeechPipelineFallback;

export interface SpeechPipeline {
  transcribe(
    input: SpeechPipelineInput,
    signal: AbortSignal,
  ): Promise<TranscriptionOutput>;
  route(
    input: TextQuestionPipelineInput,
    signal: AbortSignal,
  ): Promise<SpeechPipelineOutput>;
}
