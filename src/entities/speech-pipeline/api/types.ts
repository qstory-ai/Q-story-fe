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
  /** Already-captured web audio. Avoids re-reading a temporary blob URL. */
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
  /** Ask the beta router to expose one real choice when none was experienced yet. */
  guaranteeAgencyChoice?: boolean;
  /** Families already experienced earlier in this story session. */
  priorActionFamilyIds?: string[];
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
