import type {
  FailureReason,
  FallbackPlan,
  ResponsePlan,
  SpeechResult,
} from '@/entities/story-runtime';
import { getStoryPackage } from '@/entities/story';

import type {
  SpeechPipeline,
  SpeechPipelineDiagnostics,
  SpeechPipelineInput,
  SpeechPipelineOutput,
  TextQuestionPipelineInput,
  TranscriptionOutput,
} from './types';

type ServerSuccess = {
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

type ServerFallback = {
  ok: false;
  failure: FailureReason;
  fallback: FallbackPlan;
};

const MAX_AUDIO_UPLOAD_BYTES = Math.floor(2.5 * 1024 * 1024);

function isServerOutput(value: unknown): value is ServerSuccess | ServerFallback {
  if (!value || typeof value !== 'object' || !('ok' in value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return candidate.ok === true
    ? Boolean(candidate.speech && candidate.plan && candidate.audioText)
    : candidate.ok === false
      ? Boolean(candidate.failure && candidate.fallback)
      : false;
}

function isTranscriptionOutput(
  value: unknown,
): value is TranscriptionOutput {
  if (!value || typeof value !== 'object' || !('ok' in value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return candidate.ok === true
    ? Boolean(candidate.speech)
    : candidate.ok === false
      ? Boolean(candidate.failure && candidate.fallback)
      : false;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize),
    );
  }
  return btoa(binary);
}

async function requestStructuredOutput<T>(
  request: () => Promise<Response>,
  guard: (value: unknown) => value is T,
  signal: AbortSignal,
): Promise<{
  payload: T | null;
  status: number | null;
  transportError: Error | null;
}> {
  let lastStatus: number | null = null;
  let transportError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await request();
      lastStatus = response.status;
      transportError = null;
      const body = await response.text();
      let payload: unknown = null;
      try {
        payload = JSON.parse(body);
      } catch {
        payload = null;
      }
      if (guard(payload)) {
        const retryableFailure =
          typeof payload === 'object' &&
          payload !== null &&
          'ok' in payload &&
          payload.ok === false &&
          'failure' in payload &&
          typeof payload.failure === 'object' &&
          payload.failure !== null &&
          'retryable' in payload.failure &&
          payload.failure.retryable === true;
        if (retryableFailure && attempt === 0) {
          continue;
        }
        return {
          payload,
          status: response.status,
          transportError: null,
        };
      }
      if (attempt === 0) {
        continue;
      }
    } catch (error) {
      if (signal.aborted) {
        throw error;
      }
      transportError =
        error instanceof Error ? error : new Error('Unknown fetch failure');
      if (attempt === 0) {
        continue;
      }
    }
  }
  return { payload: null, status: lastStatus, transportError };
}

function transportErrorDetail(
  error: Error | null,
  fallback: string,
): string {
  if (!error) {
    return fallback;
  }
  const name = error.name.trim() || 'Error';
  const message = error.message.trim().slice(0, 120);
  return message
    ? `${fallback} (${name}: ${message})`
    : `${fallback} (${name})`;
}

function transportFallback(
  input: Pick<SpeechPipelineInput, 'storyId' | 'sceneId' | 'anchorId'>,
  code: string,
  safeDetail: string,
): SpeechPipelineOutput {
  const storyPackage = getStoryPackage(input.storyId);
  const anchor = storyPackage?.manifest.questionAnchors.find(
    (candidate) =>
      candidate.id === input.anchorId && candidate.sceneId === input.sceneId,
  );
  const fallback = anchor
    ? storyPackage?.manifest.fallbackFamilies.find(
        (candidate) => candidate.id === anchor.defaultFallbackFamilyId,
      )
    : null;
  if (!fallback) {
    throw new Error(
      `No package fallback for ${input.storyId}/${input.sceneId}/${input.anchorId}`,
    );
  }
  return {
    ok: false,
    failure: {
      code,
      stage: 'upload',
      retryable: true,
      safeDetail,
    },
    fallback: {
      kind: 'fallback',
      familyId: fallback.id as FallbackPlan['familyId'],
      text: '잠시 연결이 어려워서 준비된 안전 장면으로 계속할게.',
      rejoinAt: fallback.rejoinAnchorId as FallbackPlan['rejoinAt'],
    },
  };
}

export class HttpSpeechPipeline implements SpeechPipeline {
  readonly baseUrl: string;
  readonly fetchImpl: typeof fetch;

  constructor(baseUrl: string, fetchImpl: typeof fetch = fetch) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    // WebKit/Blink의 Window.fetch는 수신자(this)가 Window가 아니면
    // "Illegal invocation"을 던질 수 있다. 클래스 속성으로 보관해 호출해도
    // 항상 올바른 전역 수신자를 사용하도록 여기서 한 번 고정한다.
    this.fetchImpl = fetchImpl.bind(globalThis);
  }

  async transcribe(
    input: SpeechPipelineInput,
    signal: AbortSignal,
  ): Promise<TranscriptionOutput> {
    let recording: Blob;
    if (input.recordingData) {
      recording = input.recordingData;
    } else {
      try {
        const recordingResponse = await this.fetchImpl(input.recording.uri, {
          signal,
        });
        if (!recordingResponse.ok) {
          return transportFallback(
            input,
            'RECORDING_READ_FAILED',
            '기기에서 녹음 파일을 읽지 못했어요.',
          );
        }
        recording = await recordingResponse.blob();
      } catch (error) {
        if (signal.aborted) {
          throw error;
        }
        return transportFallback(
          input,
          'RECORDING_READ_FAILED',
          '기기에서 녹음 파일을 읽지 못했어요.',
        );
      }
    }
    if (recording.size === 0) {
      return transportFallback(
        input,
        'RECORDING_EMPTY',
        '기기에서 빈 녹음 파일이 만들어졌어요.',
      );
    }
    if (recording.size > MAX_AUDIO_UPLOAD_BYTES) {
      return transportFallback(
        input,
        'RECORDING_TOO_LARGE',
        '녹음이 30초 한도를 넘었어요. 짧게 다시 말해 주세요.',
      );
    }

    const questionHeaders = {
      'x-qstory-story-id': input.storyId,
      'x-qstory-scene-id': input.sceneId,
      'x-qstory-anchor-id': input.anchorId,
      'x-qstory-question-round': String(input.questionRound),
    };
    const useJsonAudioUpload = this.baseUrl.startsWith('/');
    let uploadUrl = `${this.baseUrl}/v1/transcriptions`;
    let uploadHeaders: Record<string, string> = {
      'content-type': input.recording.mimeType,
      ...questionHeaders,
    };
    let uploadBody: BodyInit = recording;
    if (useJsonAudioUpload) {
      try {
        uploadUrl = `${this.baseUrl}/v1/transcriptions/base64`;
        uploadHeaders = {
          'content-type': 'application/json',
          ...questionHeaders,
        };
        uploadBody = JSON.stringify({
          audioBase64: await blobToBase64(recording),
          mimeType: input.recording.mimeType,
        });
      } catch (error) {
        if (signal.aborted) {
          throw error;
        }
        return transportFallback(
          input,
          'RECORDING_ENCODE_FAILED',
          '녹음 파일을 전송용으로 준비하지 못했어요.',
        );
      }
    }

    try {
      const { payload, status, transportError } =
        await requestStructuredOutput(
          () =>
            this.fetchImpl(uploadUrl, {
              method: 'POST',
              signal,
              headers: uploadHeaders,
              body: uploadBody,
            }),
          isTranscriptionOutput,
          signal,
        );
      if (!payload) {
        return transportFallback(
          input,
          status ? `TRANSCRIPTION_SERVER_HTTP_${status}` : 'TRANSCRIPTION_SERVER_UNREACHABLE',
          status
            ? `음성 인식 서버가 응답 형식을 지키지 못했어요. (HTTP ${status})`
            : transportErrorDetail(
                transportError,
                '브라우저가 음성 인식 서버 요청을 시작하지 못했어요.',
              ),
        );
      }
      return payload;
    } catch (error) {
      if (signal.aborted) {
        throw error;
      }
      return transportFallback(
        input,
        'TRANSCRIPTION_SERVER_UNREACHABLE',
        '음성 인식 서버에 연결하지 못했어요.',
      );
    }
  }

  async route(
    input: TextQuestionPipelineInput,
    signal: AbortSignal,
  ): Promise<SpeechPipelineOutput> {
    try {
      const { payload, status, transportError } =
        await requestStructuredOutput(
          () =>
            this.fetchImpl(`${this.baseUrl}/v1/questions/route`, {
              method: 'POST',
              signal,
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(input),
            }),
          isServerOutput,
          signal,
        );
      if (!payload) {
        return transportFallback(
          input,
          status ? `ROUTE_SERVER_HTTP_${status}` : 'ROUTE_SERVER_UNREACHABLE',
          status
            ? `질문 서버가 응답 형식을 지키지 못했어요. (HTTP ${status})`
            : transportErrorDetail(
                transportError,
                '브라우저가 질문 서버 요청을 시작하지 못했어요.',
              ),
        );
      }
      return payload;
    } catch (error) {
      if (signal.aborted) {
        throw error;
      }
      return transportFallback(
        input,
        'ROUTE_SERVER_UNREACHABLE',
        '질문 서버에 연결하지 못했어요.',
      );
    }
  }

  async process(
    input: SpeechPipelineInput,
    signal: AbortSignal,
  ): Promise<SpeechPipelineOutput> {
    const transcription = await this.transcribe(input, signal);
    if (!transcription.ok) {
      return transcription;
    }
    return this.route(
      {
        transcript: transcription.speech.transcript,
        storyId: input.storyId,
        sceneId: input.sceneId,
        anchorId: input.anchorId,
        questionRound: input.questionRound,
      },
      signal,
    );
  }

  async processText(
    input: TextQuestionPipelineInput,
    signal: AbortSignal,
  ): Promise<SpeechPipelineOutput> {
    return this.route(input, signal);
  }
}
