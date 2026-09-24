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

type FailureEnvelope = {
  ok?: boolean;
  failure?: { code?: string; retryable?: boolean; safeDetail?: string };
};

/**
 * 컴패니언 챗 백엔드(CompanionChatPipelineService)는 STT·LLM 실패를 HTTP 오류가 아니라
 * HTTP 200 + {ok:false, failure:{code, stage, retryable, safeDetail}} 봉투로 돌려준다 -
 * /v1/transcriptions·/v1/questions/route가 쓰는 것과 같은 관례다. 그래서 response.ok만 보면
 * 실패 본문을 성공 응답으로 읽게 되므로, 상태 코드와 무관하게 본문의 ok를 먼저 확인한다.
 * 프록시/게이트웨이가 JSON이 아닌 오류 페이지(502/503 등)를 돌려줄 수 있으니 response.json()이
 * 원시 SyntaxError를 던지지 않도록 감싼다 (다른 API client들의 request<T>()가 이미 하는 것과 같은 방어).
 */
async function readBody<T extends FailureEnvelope>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  let body: T | undefined;
  try {
    body = (await response.json()) as T;
  } catch {
    // 실패 응답 본문을 읽지 못하면 아래 기본 메시지로 대체한다.
  }
  if (!response.ok || !body || body.ok === false) {
    const failure = body?.failure;
    throw new CompanionChatError(
      failure?.safeDetail ?? fallbackMessage,
      failure?.code,
      failure?.retryable,
    );
  }
  return body;
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
/**
 * 백엔드 대화 원장(conversation_record) 귀속용 선택 식별자 - 질문 파이프라인의
 * ConversationAttributionInput과 같은 뜻. 없으면 익명으로 기록된다.
 */
export type CompanionChatAttribution = {
  childId?: string;
  tutorStudentId?: string;
  lessonId?: string;
};

export async function transcribeCompanionChatAudio(
  input: { storyId: string; sceneId: string; audioBlob: Blob; mimeType: string; sessionId?: string } & CompanionChatAttribution,
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
      sessionId: input.sessionId,
      childId: input.childId,
      tutorStudentId: input.tutorStudentId,
      lessonId: input.lessonId,
    }),
  });

  const body = await readBody<FailureEnvelope & { transcript?: string }>(
    response,
    '지금은 목소리를 인식하지 못했어요.',
  );
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
    /**
     * 아이가 대화 중인 캐릭터(companion-character.ts가 고른 헨젤/그레텔의 speakerId). 백엔드는 이
     * 값으로 story_persona(personas.yaml 임포트본)의 페르소나와 TTS 보이스를 고르므로, 화면의
     * 아바타와 답변의 말투·목소리가 같은 인물이 된다. 안 보내면 백엔드가 장면의 앵커 화자나
     * 내레이터로 정한다(구버전 동작).
     */
    speakerId?: string;
    /** VOICE = 방금 STT로 받아 적은 문장을 그대로 보냄, TEXT = 글로 입력. */
    inputMode?: 'VOICE' | 'TEXT';
  } & CompanionChatAttribution,
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

  const body = await readBody<
    FailureEnvelope & {
      responseText: string;
      safety: { mode: CompanionChatSafetyMode };
      audio?: { mimeType: string; dataBase64: string };
    }
  >(response, '지금은 대답을 준비하지 못했어요.');
  return {
    responseText: body.responseText,
    safetyMode: body.safety.mode,
    audio: body.audio ? { mimeType: body.audio.mimeType, dataBase64: body.audio.dataBase64 } : null,
  };
}
