import { authorizationHeader } from '@/shared/api';
import { apiBaseUrl } from '@/shared/config';

import { getBetaSessionId } from './beta-events';
import { byteLength } from './interaction-shapes';
import { currentInteractionPlaySessionId } from './interaction-tracker';
import {
  RecordingGate,
  RecordingStateStore,
  encodeGroup,
  eventsJson,
  groupEventStrings,
  type RecordingChunkBody,
  type RecordingEncoding,
} from './recording-chunks';

/**
 * 화면 녹화(rrweb) - 녹화를 허용한 방문자의 화면만 DOM 변화로 기록해 10초마다 조각으로 올린다(POST /v1/session-recordings/chunks).
 * 허용 여부는 recording-consent.ts가 정하고 UsageTracking이 setSessionRecordingPermitted로 넣는다.
 * UT에서 "어디서 왜 멈췄는지"를 영상처럼 다시 본다. 입력칸은 rrweb가 가린다(maskAllInputs).
 * rrweb는 첫 화면을 그린 뒤 한가할 때 따로 불러온다 - 첫 화면 번들에 들어가지 않는다.
 */

const CHUNK_INTERVAL_MS = 10_000;
/** 버퍼가 이만큼(JSON 길이) 쌓이면 10초를 기다리지 않고 올린다. */
const CHUNK_TRIGGER_CHARS = 400_000;
/** 한 번 연 화면에서 녹화하는 최대 시간. */
const MAX_RECORDING_MS = 60 * 60_000;
/** 서버 상한(50MB)보다 조금 아래에서 멈춘다 - 통계 세션 단위로 저장해 두고 센다. */
const MAX_UPLOADED_BYTES = 45 * 1024 * 1024;
/** 페이지를 닫을 때 keepalive로 보낼 수 있는 크기(브라우저 합계 64KB를 사용 기록과 나눠 쓴다). */
const KEEPALIVE_BODY_BYTES = 32_000;
/** 10분마다 전체 화면을 다시 찍는다 - 앞 조각을 잃어도 그 뒤부터는 다시 볼 수 있게. */
const CHECKOUT_EVERY_MS = 10 * 60_000;

type BufferedEvent = { json: string; timestamp: number };

const store = new RecordingStateStore(safeLocalStorage());
const gate = new RecordingGate();

let buffer: BufferedEvent[] = [];
let bufferChars = 0;
let stopRecord: (() => void) | null = null;
let loading = false;
/** 불러오는 중에 멈추면 늦게 도착한 rrweb가 녹화를 시작하지 않게 하는 번호. */
let generation = 0;
let limitReached = false;
let recordingStartedAt = 0;
let flushTimer: ReturnType<typeof setInterval> | null = null;
let uploadChain: Promise<void> = Promise.resolve();
/** 허용을 거두면 늘린다 - 이미 줄 선 올리기도 보내지 않는다. */
let uploadGeneration = 0;
let listenersInstalled = false;

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function endpoint() {
  return `${apiBaseUrl}/v1/session-recordings/chunks`;
}

function onEmit(event: { timestamp: number }) {
  if (!stopRecord && !loading) return;
  try {
    const json = JSON.stringify(event);
    buffer.push({ json, timestamp: event.timestamp });
    bufferChars += json.length + 1;
    if (bufferChars >= CHUNK_TRIGGER_CHARS) void flushRecording();
  } catch {
    // 직렬화하지 못한 이벤트는 버린다.
  }
}

function takeBuffer() {
  const taken = buffer;
  buffer = [];
  bufferChars = 0;
  return taken;
}

function chunkBody(events: readonly BufferedEvent[], encoding: RecordingEncoding, data: string): RecordingChunkBody {
  const betaSessionId = getBetaSessionId();
  return {
    betaSessionId,
    playSessionId: currentInteractionPlaySessionId(),
    seq: store.takeSeq(betaSessionId),
    startedAt: new Date(events[0].timestamp).toISOString(),
    endedAt: new Date(events[events.length - 1].timestamp).toISOString(),
    eventCount: events.length,
    encoding,
    data,
  };
}

async function failureCodeOf(response: Response): Promise<string | null> {
  if (response.status !== 403) return null;
  try {
    return ((await response.json()) as { failure?: { code?: string } }).failure?.code ?? null;
  } catch {
    return null;
  }
}

/**
 * 올리기 - 413(서버 상한)이면 이 통계 세션은 녹화를 멈춘다. 403 RECORDING_NOT_CONSENTED(동의 없음)면 바로 멈추고
 * 쌓인 것을 버린다(다시 보내지 않는다). 네트워크·5xx는 한 번 더 해 보고 버린다.
 */
async function upload(body: RecordingChunkBody, keepalive = false): Promise<void> {
  const text = JSON.stringify(body);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(endpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authorizationHeader() },
        body: text,
        keepalive,
      });
      const outcome = gate.observe(response.status, await failureCodeOf(response));
      if (outcome === 'ok') {
        store.addUploaded(body.betaSessionId, body.data.length);
        if (store.load(body.betaSessionId).uploadedBytes >= MAX_UPLOADED_BYTES) stopSessionRecording({ limit: true });
        return;
      }
      if (outcome === 'capped') {
        store.markCapped(body.betaSessionId);
        stopSessionRecording({ limit: true });
        return;
      }
      if (outcome === 'not-consented') {
        cancelSessionRecording();
        return;
      }
      if (outcome === 'drop') return;
    } catch {
      // 일시적 네트워크 실패 - 같은 seq로 한 번 더(서버가 멱등).
    }
    if (keepalive) return;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
}

/** 쌓인 이벤트를 조각으로 묶어 차례로 올린다. 화면을 막지 않고 throw하지 않는다. */
export function flushRecording(): Promise<void> {
  if (buffer.length === 0) return uploadChain;
  const events = takeBuffer();
  const byJson = new Map(events.map((event) => [event.json, event] as const));
  const mine = uploadGeneration;
  uploadChain = uploadChain
    .then(async () => {
      for (const group of groupEventStrings(events.map((event) => event.json))) {
        for (const piece of await encodeGroup(group)) {
          if (mine !== uploadGeneration || !gate.canRecord()) return;
          if (store.load(getBetaSessionId()).capped) return;
          const pieceEvents = piece.events.map((json) => byJson.get(json)!).filter(Boolean);
          await upload(chunkBody(pieceEvents, piece.encoding, piece.data));
        }
      }
    })
    .catch(() => {});
  if (recordingStartedAt && Date.now() - recordingStartedAt > MAX_RECORDING_MS) stopSessionRecording({ limit: true });
  return uploadChain;
}

/**
 * 페이지가 닫힐 때 - 압축(비동기)을 기다릴 수 없어 JSON 그대로, keepalive 한도 안에 드는 앞부분만 보낸다. 나머지는 잃어도 된다.
 */
function flushOnPageHide() {
  if (buffer.length === 0 || !gate.canRecord()) return;
  const events = takeBuffer();
  const fitting: BufferedEvent[] = [];
  let size = 400;
  for (const event of events) {
    const bytes = byteLength(event.json) + 1;
    if (size + bytes > KEEPALIVE_BODY_BYTES) break;
    fitting.push(event);
    size += bytes;
  }
  if (fitting.length === 0) return;
  void upload(chunkBody(fitting, 'json', eventsJson(fitting.map((event) => event.json))), true);
}

function installPageListeners() {
  if (listenersInstalled) return;
  listenersInstalled = true;
  document.addEventListener('visibilitychange', () => {
    // 탭을 숨기면(앱 전환) 아직 시간이 있다 - 압축해서 올린다.
    if (document.visibilityState === 'hidden') void flushRecording();
  });
  window.addEventListener('pagehide', flushOnPageHide);
}

function whenIdle(callback: () => void) {
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number })
    .requestIdleCallback;
  if (idle) idle(callback, { timeout: 4_000 });
  else setTimeout(callback, 1_500);
}

/**
 * 녹화 허용이 바뀔 때(UsageTracking). 거두면 바로 멈추고 아직 올리지 않은 것을 버린다.
 * 허용해도 여기서 시작하지는 않는다 - startSessionRecording을 부른다.
 */
export function setSessionRecordingPermitted(permitted: boolean) {
  gate.setPermitted(permitted);
  if (!permitted) cancelSessionRecording();
}

/** 녹화 시작 - 첫 화면을 그린 뒤 한가할 때 rrweb를 불러온다. 허용이 없거나, 이미 녹화 중이거나, 상한에 닿았으면 아무것도 하지 않는다. */
export function startSessionRecording() {
  if (typeof window === 'undefined' || !apiBaseUrl || !gate.canRecord() || stopRecord || loading || limitReached) return;
  const state = store.load(getBetaSessionId());
  if (state.capped || state.uploadedBytes >= MAX_UPLOADED_BYTES) return;
  loading = true;
  const mine = ++generation;
  whenIdle(() => {
    import('@rrweb/record')
      .then(({ record }) => {
        // 불러오는 사이에 멈추라고 했으면(내부 다시 보기 화면 등) 시작하지 않는다.
        if (mine !== generation) return;
        recordingStartedAt ||= Date.now();
        const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
        stopRecord =
          record({
            emit: onEmit,
            maskAllInputs: true,
            recordCanvas: false,
            inlineImages: false,
            collectFonts: false,
            checkoutEveryNms: CHECKOUT_EVERY_MS,
            sampling: {
              // 터치 기기는 마우스 이동이 없다 - 끈다. 데스크톱은 200ms에 한 번.
              mousemove: touch ? false : 200,
              scroll: 150,
              input: 'last',
            },
          }) ?? null;
        installPageListeners();
        flushTimer ??= setInterval(() => void flushRecording(), CHUNK_INTERVAL_MS);
      })
      .catch(() => {
        // 불러오지 못하면 녹화 없이 그대로 쓴다.
      })
      .finally(() => {
        if (mine === generation) loading = false;
      });
  });
}

/**
 * 녹화를 멈추고 남은 것을 올린다. limit이면(시간·용량 상한) 이 화면에서는 다시 시작하지 않는다.
 * 내부 다시 보기 화면에서는 limit 없이 멈췄다가 다른 화면으로 가면 다시 시작한다.
 */
export function stopSessionRecording({ limit = false }: { limit?: boolean } = {}) {
  halt();
  if (limit) limitReached = true;
  void flushRecording();
}

/** 허용을 거뒀거나 서버가 동의 없음으로 거절했다 - 멈추고, 쌓인 것과 줄 선 올리기를 보내지 않고 버린다. */
export function cancelSessionRecording() {
  halt();
  takeBuffer();
  uploadGeneration += 1;
}

function halt() {
  generation += 1;
  loading = false;
  try {
    stopRecord?.();
  } catch {
    // 멈추다 난 오류는 무시한다.
  }
  stopRecord = null;
  if (flushTimer !== null) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}
