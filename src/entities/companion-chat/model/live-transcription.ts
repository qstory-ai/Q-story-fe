import { speechApiUrl } from '@/entities/speech-pipeline';
import { authorizationHeader } from '@/shared/api';
import { sttStreamUrl } from '@/shared/config';

import type { CompanionChatAttribution } from './companion-chat-client';

/**
 * 실시간 받아 적기 - 말하는 동안 16kHz PCM을 백엔드(wss /v1/stt/stream)로 보내 중간 문장을 받고, 말이 끝나면 확정
 * 문장을 바로 받는다(배치는 녹음을 다 올린 뒤 RTZR을 폴링해 중앙값 ~5초). 표는 프록시를 거치는 보통 POST로 받고,
 * 소켓은 백엔드에 직접 붙는다(Vercel 프록시는 WebSocket을 들지 못한다). 브라우저 WebSocket은 Authorization 헤더를 못
 * 실으니 1회용 표(?ticket=)가 인증이다.
 *
 * 무엇이든 실패하면(표 거절·연결 실패·도중 끊김·시간 초과) finish()가 null을 돌려준다 - 호출부는 같이 녹음해 둔
 * blob으로 배치 받아 적기를 한다. 그래서 여기서는 오류를 던지지 않는다.
 */
export type LiveTranscription = {
  /** 녹음 중 PCM 조각(16kHz mono s16le) - 연결 전이면 모아 뒀다가 보낸다. */
  push: (frame: Int16Array) => void;
  /** 말이 끝났다 - 확정 문장을 기다린다. 실패·빈 문장·시간 초과면 null. */
  finish: () => Promise<string | null>;
  /** 버린다(닫기·다시 말하기·글로 쓰기). */
  abort: () => void;
  /** 이미 실패해서 finish()가 null일 게 확실한지(배치를 바로 시작해도 되는지). */
  readonly failed: boolean;
};

export type LiveTranscriptionInput = {
  storyId: string;
  sceneId: string;
  sessionId?: string;
  onPartial?: (text: string) => void;
} & CompanionChatAttribution;

type Deps = {
  fetch: typeof fetch;
  createSocket: (url: string) => WebSocket;
  ticketUrl: string;
  streamUrl: string;
  /** 끝 신호 뒤 확정 문장을 기다리는 시간 - 서버는 4초 안에 답한다. 넘으면 배치로 간다. */
  finalTimeoutMs: number;
  /** 표 받기 + 연결 상한 - 말이 짧아 끝날 때까지 연결이 안 됐으면 이만큼만 더 기다린다. */
  connectTimeoutMs: number;
};

/** 연결 전 모아 두는 오디오 상한(약 35초) - 넘으면 접고 배치로 간다. */
const MAX_BUFFERED_FRAMES = 350;

function defaultDeps(): Deps {
  return {
    fetch: (...args) => fetch(...args),
    createSocket: (url) => new WebSocket(url),
    ticketUrl: `${speechApiUrl}/v1/stt/stream-tickets`,
    streamUrl: sttStreamUrl(),
    finalTimeoutMs: 5_000,
    connectTimeoutMs: 4_000,
  };
}

type ServerMessage =
  | { type: 'ready' }
  | { type: 'partial'; text: string }
  | { type: 'final'; ok: true; transcript: string }
  | { type: 'final'; ok: false; code?: string }
  | { type: 'error'; code?: string };

export function startLiveTranscription(
  input: LiveTranscriptionInput,
  overrides: Partial<Deps> = {},
): LiveTranscription {
  const deps = { ...defaultDeps(), ...overrides };
  const controller = new AbortController();
  const queue: Int16Array[] = [];
  let socket: WebSocket | null = null;
  let failed = false;
  let ended = false;
  let finalText: string | null | undefined;
  let settle: ((text: string | null) => void) | null = null;
  let finishPromise: Promise<string | null> | null = null;

  const resolveFinal = (text: string | null) => {
    if (finalText !== undefined) return;
    finalText = text;
    settle?.(text);
  };

  const fail = () => {
    if (failed) return;
    failed = true;
    queue.length = 0;
    resolveFinal(null);
    try {
      socket?.close();
    } catch {
      // 이미 닫혔다
    }
  };

  const sendEnd = () => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'end' }));
  };

  const flush = () => {
    if (socket?.readyState !== WebSocket.OPEN) return;
    for (const frame of queue) socket.send(frame);
    queue.length = 0;
  };

  void (async () => {
    try {
      const response = await deps.fetch(deps.ticketUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'content-type': 'application/json', ...authorizationHeader() },
        body: JSON.stringify({
          storyId: input.storyId,
          sceneId: input.sceneId,
          sessionId: input.sessionId,
          childId: input.childId,
          tutorStudentId: input.tutorStudentId,
          lessonId: input.lessonId,
        }),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; ticket?: string } | null;
      if (!response.ok || !body?.ok || !body.ticket || failed) {
        fail();
        return;
      }
      const ws = deps.createSocket(`${deps.streamUrl}?ticket=${encodeURIComponent(body.ticket)}`);
      ws.binaryType = 'arraybuffer';
      socket = ws;
      ws.onopen = () => {
        flush();
        if (ended) sendEnd();
      };
      ws.onmessage = (event: MessageEvent) => {
        if (typeof event.data !== 'string') return;
        let message: ServerMessage;
        try {
          message = JSON.parse(event.data) as ServerMessage;
        } catch {
          return;
        }
        if (message.type === 'partial') {
          if (!ended) input.onPartial?.(message.text);
        } else if (message.type === 'final') {
          resolveFinal(message.ok && message.transcript.trim() ? message.transcript.trim() : null);
        } else if (message.type === 'error') {
          fail();
        }
      };
      ws.onerror = () => fail();
      ws.onclose = () => {
        // 확정 문장 없이 닫혔다(서버 재시작·연결 끊김) - 배치로 간다.
        if (finalText === undefined) fail();
      };
      if (controller.signal.aborted) fail();
    } catch {
      fail();
    }
  })();

  return {
    push(frame) {
      if (failed || ended) return;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(frame);
        return;
      }
      queue.push(frame);
      if (queue.length > MAX_BUFFERED_FRAMES) fail();
    },
    finish() {
      finishPromise ??= new Promise<string | null>((resolve) => {
        if (finalText !== undefined) {
          resolve(finalText);
          return;
        }
        ended = true;
        const opened = socket?.readyState === WebSocket.OPEN;
        const timer = setTimeout(
          () => fail(),
          deps.finalTimeoutMs + (opened ? 0 : deps.connectTimeoutMs),
        );
        settle = (text) => {
          clearTimeout(timer);
          resolve(text);
        };
        if (opened) {
          flush();
          sendEnd();
        }
      }).finally(() => {
        try {
          socket?.close();
        } catch {
          // 이미 닫혔다
        }
      });
      return finishPromise;
    },
    abort() {
      controller.abort();
      fail();
    },
    get failed() {
      return failed;
    },
  };
}
