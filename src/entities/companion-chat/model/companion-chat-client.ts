import { speechApiUrl } from '@/entities/speech-pipeline';
import { authorizationHeader } from '@/shared/api';
import type { BufferedResponseAudio } from '@/features/route-question';

export type CompanionChatSafetyMode = 'ANSWER' | 'GENTLE_REDIRECT';

export type CompanionReplyKind = 'ANSWER' | 'EMPATHY' | 'WAIT' | 'CLOSE' | 'REDIRECT';

/** Q-31 대화 표시 - 종료·도움·행동 확인 단계를 정하는 데 쓴다. 예전 서버면 기본값으로 채운다. */
export type CompanionDialogueSignal = {
  replyKind: CompanionReplyKind;
  childWantsToEnd: boolean;
  childMeaning: string;
  asksForHelp: boolean;
  /** 질문 초대에서 아이가 제안한 준비된 행동(뜻 확인 전). */
  proposedActionFamilyId: string | null;
};

export type CompanionChatReply = {
  responseText: string;
  safetyMode: CompanionChatSafetyMode;
  audio: BufferedResponseAudio | null;
  /** deferAudio로 보냈더니 서버가 음성 없이 글만 먼저 돌려줬다 - 음성은 따로 받는다(fetchLineNarration). */
  audioDeferred: boolean;
  dialogue: CompanionDialogueSignal;
};

/** 그레텔 대화가 한 턴마다 같이 보내는 맥락(BE DialogueInput). 모두 선택. */
export type CompanionDialogueContext = {
  history?: { role: 'CHILD' | 'CHARACTER'; text: string }[];
  scene?: { title: string; storySoFar: string[]; recentLines: string[]; visual: string } | null;
  executedActions?: string[];
  /** 질문 초대 중이면 그 앵커 id. */
  anchorId?: string | null;
  wrapUp?: 'NONE' | 'SUGGEST_RETURN' | 'CLOSE';
  /**
   * 질문 초대에서 "도와줘"를 눌렀을 때만 - 이번 도움 단계와 그 단계의 미리 쓴 도움 대사. 그레텔은 이 대사를
   * 방향으로 삼아 앞 대화에 이어지게 새로 말한다(BE DialogueInput.Help).
   */
  help?: { step: number; total: number; hint: string };
  /** true면 서버가 음성을 만들지 않고 글 답만 바로 돌려준다 - 말풍선을 먼저 띄우려고(음성이 기다림의 대부분). */
  deferAudio?: boolean;
};

/**
 * shared/api의 requestJson()을 쓰지 않는다 - 이 엔드포인트는 실패를 HTTP 200 + {ok:false} 봉투로도
 * 돌려주고 retryable을 함께 실어 보내서, 아래 readBody()가 직접 판별한다.
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
 * 백엔드 대화 원장(conversation_record) 귀속용 선택 식별자 - 질문 파이프라인의
 * ConversationAttributionInput과 같은 뜻. 없으면 익명으로 기록된다.
 */
export type CompanionChatAttribution = {
  childId?: string;
  tutorStudentId?: string;
  lessonId?: string;
};

/**
 * 질문 흐름의 http-speech-pipeline.ts와 같은 base64 업로드 방식이다 - speechApiUrl은 항상
 * same-origin 프록시 경로라 raw binary 업로드가 필요 없다. 컴패니언 챗에는 anchor/questionRound가
 * 없어 전용 엔드포인트를 쓰고, 텍스트만 돌려받는다.
 */
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
    headers: { 'content-type': 'application/json', ...authorizationHeader() },
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
     * 내레이터로 정한다.
     */
    speakerId?: string;
    /** VOICE = 방금 STT로 받아 적은 문장을 그대로 보냄, TEXT = 글로 입력. */
    inputMode?: 'VOICE' | 'TEXT';
  } & CompanionChatAttribution & CompanionDialogueContext,
  signal?: AbortSignal,
): Promise<CompanionChatReply> {
  if (!speechApiUrl) {
    throw new CompanionChatError('VITE_QSTORY_API_URL is not configured.');
  }
  const response = await fetch(`${speechApiUrl}/v1/companion-chat/messages`, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', ...authorizationHeader() },
    body: JSON.stringify(input),
  });

  const body = await readBody<
    FailureEnvelope & {
      responseText: string;
      safety: { mode: CompanionChatSafetyMode };
      audio?: { mimeType: string; dataBase64: string };
      audioDeferred?: boolean;
      dialogue?: Partial<CompanionDialogueSignal>;
    }
  >(response, '지금은 대답을 준비하지 못했어요.');
  return {
    responseText: body.responseText,
    safetyMode: body.safety.mode,
    audio: body.audio ? { mimeType: body.audio.mimeType, dataBase64: body.audio.dataBase64 } : null,
    // 예전 서버는 deferAudio를 모르고 음성을 같이 보낸다 - 그때는 false라 그 음성을 그대로 쓴다.
    audioDeferred: body.audioDeferred === true && !body.audio,
    dialogue: {
      replyKind: body.dialogue?.replyKind ?? (body.safety.mode === 'GENTLE_REDIRECT' ? 'REDIRECT' : 'ANSWER'),
      childWantsToEnd: body.dialogue?.childWantsToEnd ?? false,
      childMeaning: body.dialogue?.childMeaning ?? '',
      asksForHelp: body.dialogue?.asksForHelp ?? false,
      proposedActionFamilyId: body.dialogue?.proposedActionFamilyId ?? null,
    },
  };
}
