import { speechApiUrl } from '@/entities/speech-pipeline';
import type { BufferedResponseAudio } from '@/features/route-question';

export type CompanionChatSafetyMode = 'ANSWER' | 'GENTLE_REDIRECT';

export type CompanionChatReply = {
  responseText: string;
  safetyMode: CompanionChatSafetyMode;
  audio: BufferedResponseAudio | null;
};

/**
 * 백엔드의 실패 응답 형태는 auth-api.ts의 것({ok:false, failure:{code, safeDetail}})과 동일하지만,
 * 공유 헬퍼 대신 이 도메인만의 작은 클라이언트로 따로 둔다 - 이 코드베이스는 공유 request<T>()
 * 추상화보다 도메인별로 파일 하나씩 두는 방식을 선호한다 (story-api.ts와 같은 이유).
 */
export class CompanionChatError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly retryable?: boolean,
  ) {
    super(message);
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

/**
 * 앵커 기반 질문 흐름의 http-speech-pipeline.ts가 쓰는 base64 업로드 방식을 그대로 따른다 -
 * speechApiUrl은 항상 same-origin 프록시 경로(/api/qstory)라 raw binary 업로드는 필요 없다.
 * 컴패니언 챗에는 anchor/questionRound가 없으므로 백엔드도 /v1/companion-chat/transcriptions/base64로
 * 분리된 엔드포인트를 쓴다(음성 답변 라우팅과 무관하게 텍스트만 돌려준다).
 */
export async function transcribeCompanionChatAudio(
  input: { storyId: string; sceneId: string; audioBlob: Blob; mimeType: string },
  signal?: AbortSignal,
): Promise<string> {
  if (!speechApiUrl) {
    throw new CompanionChatError('VITE_QSTORY_API_URL is not configured.');
  }
  const response = await fetch(`${speechApiUrl}/v1/companion-chat/transcriptions/base64`, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      audioBase64: await blobToBase64(input.audioBlob),
      mimeType: input.mimeType,
      storyId: input.storyId,
      sceneId: input.sceneId,
    }),
  });

  if (!response.ok) {
    let failure: { code?: string; retryable?: boolean; safeDetail?: string } | undefined;
    try {
      const parsed = (await response.json()) as { failure?: typeof failure };
      failure = parsed.failure;
    } catch {
      // 실패 응답 본문을 읽지 못하면 아래 기본 메시지로 대체한다.
    }
    throw new CompanionChatError(
      failure?.safeDetail ?? '지금은 목소리를 인식하지 못했어요.',
      failure?.code,
      failure?.retryable,
    );
  }

  const body = (await response.json()) as { transcript?: string };
  if (!body.transcript) {
    throw new CompanionChatError('이번에는 말소리를 문장으로 확인하지 못했어요.');
  }
  return body.transcript;
}

export async function sendCompanionChatMessage(
  input: {
    storyId: string;
    sceneId: string;
    conversationId: string;
    transcript: string;
  },
  signal?: AbortSignal,
): Promise<CompanionChatReply> {
  if (!speechApiUrl) {
    throw new CompanionChatError('VITE_QSTORY_API_URL is not configured.');
  }
  const response = await fetch(`${speechApiUrl}/v1/companion-chat/messages`, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    // 프록시/게이트웨이가 JSON이 아닌 오류 페이지(502/503 등)를 돌려줄 수 있으니, 이 실패
    // 경로에서는 response.json()이 원시 SyntaxError를 던지지 않도록 감싼다 (다른 API
    // client들의 request<T>()가 이미 하는 것과 같은 방어).
    let failure: { code?: string; retryable?: boolean; safeDetail?: string } | undefined;
    try {
      const parsed = (await response.json()) as { failure?: typeof failure };
      failure = parsed.failure;
    } catch {
      // 실패 응답 본문을 읽지 못하면 아래 기본 메시지로 대체한다.
    }
    throw new CompanionChatError(
      failure?.safeDetail ?? '지금은 대답을 준비하지 못했어요.',
      failure?.code,
      failure?.retryable,
    );
  }

  const body = (await response.json()) as {
    responseText: string;
    safety: { mode: CompanionChatSafetyMode };
    audio?: { mimeType: string; dataBase64: string };
  };
  return {
    responseText: body.responseText,
    safetyMode: body.safety.mode,
    audio: body.audio ? { mimeType: body.audio.mimeType, dataBase64: body.audio.dataBase64 } : null,
  };
}
