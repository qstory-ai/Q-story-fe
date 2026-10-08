/**
 * 화면 녹화 조각(POST /v1/session-recordings/chunks)을 만드는 순수 로직 - 묶기·압축·번호(seq)·누적 용량.
 * rrweb와 화면은 session-recorder.ts가 다룬다. 이 파일은 Node 테스트에서 그대로 돈다.
 */

export type RecordingEncoding = 'gzip-base64' | 'json';

export type RecordingChunkBody = {
  betaSessionId: string;
  playSessionId?: string | null;
  seq: number;
  startedAt: string;
  endedAt: string;
  eventCount: number;
  encoding: RecordingEncoding;
  data: string;
};

/** 서버 한도는 1,000,000자 - 여유를 둔다. */
export const MAX_CHUNK_DATA_CHARS = 900_000;
/** 압축 전 한 묶음의 JSON 길이 - 압축이 없어도(json) 한도 안에 들어가게. */
export const MAX_GROUP_JSON_CHARS = 600_000;

/**
 * 직렬화된 이벤트(JSON 문자열)들을 JSON 길이 기준으로 묶는다. 순서는 그대로 둔다.
 * 혼자서 한도를 넘는 이벤트(아주 큰 첫 화면 스냅숏)도 한 묶음으로 둔다 - 압축하면 대개 들어간다.
 */
export function groupEventStrings(events: readonly string[], maxChars = MAX_GROUP_JSON_CHARS): string[][] {
  const groups: string[][] = [];
  let current: string[] = [];
  let size = 2;
  for (const event of events) {
    const length = event.length + 1;
    if (current.length > 0 && size + length > maxChars) {
      groups.push(current);
      current = [];
      size = 2;
    }
    current.push(event);
    size += length;
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

export function eventsJson(events: readonly string[]) {
  return `[${events.join(',')}]`;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const step = 0x8000;
  for (let index = 0; index < bytes.length; index += step) {
    binary += String.fromCharCode(...bytes.subarray(index, index + step));
  }
  return btoa(binary);
}

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function pipeThrough(bytes: Uint8Array, stream: GenericTransformStream) {
  const source = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(source).arrayBuffer());
}

/** gzip이 되면 gzip→base64, 아니면 JSON 그대로. */
export async function encodeEvents(json: string): Promise<{ encoding: RecordingEncoding; data: string }> {
  if (typeof CompressionStream === 'undefined') return { encoding: 'json', data: json };
  try {
    const compressed = await pipeThrough(new TextEncoder().encode(json), new CompressionStream('gzip'));
    return { encoding: 'gzip-base64', data: bytesToBase64(compressed) };
  } catch {
    return { encoding: 'json', data: json };
  }
}

/** 내부 다시 보기 화면에서 조각을 풀어 이벤트 배열로. */
export async function decodeEvents(encoding: string, data: string): Promise<unknown[]> {
  if (encoding === 'json') return JSON.parse(data) as unknown[];
  if (encoding !== 'gzip-base64') throw new Error(`unknown encoding ${encoding}`);
  const bytes = await pipeThrough(base64ToBytes(data), new DecompressionStream('gzip'));
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown[];
}

/**
 * 묶음 하나를 서버 한도 안의 조각들로 - 압축 뒤에도 900,000자를 넘으면 반으로 나눠 다시 만든다.
 * 이벤트 하나만으로도 넘으면 그 이벤트는 버린다(서버가 받지 못한다).
 */
export async function encodeGroup(
  events: readonly string[],
  maxDataChars = MAX_CHUNK_DATA_CHARS,
): Promise<{ events: readonly string[]; encoding: RecordingEncoding; data: string }[]> {
  if (events.length === 0) return [];
  const encoded = await encodeEvents(eventsJson(events));
  if (encoded.data.length <= maxDataChars) return [{ events, ...encoded }];
  if (events.length === 1) return [];
  const middle = Math.ceil(events.length / 2);
  return [
    ...(await encodeGroup(events.slice(0, middle), maxDataChars)),
    ...(await encodeGroup(events.slice(middle), maxDataChars)),
  ];
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const STATE_STORAGE_KEY = 'qstory.recording.state.v1';

export type RecordingState = {
  betaSessionId: string;
  nextSeq: number;
  uploadedBytes: number;
  /** 서버가 이 통계 세션의 용량을 다 썼다고 알린 뒤(413) - 다시 녹화하지 않는다. */
  capped: boolean;
};

/**
 * 조각 번호·누적 용량을 통계 세션별로 저장한다 - 새로고침해도 seq가 이어져 서버의 (betaSessionId, seq) 멱등이 맞는다.
 * 저장소가 없으면 메모리로만 센다.
 */
export class RecordingStateStore {
  private memory: RecordingState | null = null;

  constructor(private readonly storage: StorageLike | null) {}

  load(betaSessionId: string): RecordingState {
    if (this.memory?.betaSessionId === betaSessionId) return this.memory;
    let stored: Partial<RecordingState> | null = null;
    try {
      const raw = this.storage?.getItem(STATE_STORAGE_KEY);
      stored = raw ? (JSON.parse(raw) as Partial<RecordingState>) : null;
    } catch {
      stored = null;
    }
    this.memory =
      stored && stored.betaSessionId === betaSessionId
        ? {
            betaSessionId,
            nextSeq: Math.max(0, Math.floor(Number(stored.nextSeq) || 0)),
            uploadedBytes: Math.max(0, Number(stored.uploadedBytes) || 0),
            capped: stored.capped === true,
          }
        : { betaSessionId, nextSeq: 0, uploadedBytes: 0, capped: false };
    return this.memory;
  }

  /** 다음 seq를 하나 받아 간다(보내기 전에 저장 - 같은 번호를 두 번 쓰지 않게). */
  takeSeq(betaSessionId: string): number {
    const state = this.load(betaSessionId);
    const seq = state.nextSeq;
    this.save({ ...state, nextSeq: seq + 1 });
    return seq;
  }

  addUploaded(betaSessionId: string, bytes: number) {
    const state = this.load(betaSessionId);
    this.save({ ...state, uploadedBytes: state.uploadedBytes + bytes });
  }

  markCapped(betaSessionId: string) {
    this.save({ ...this.load(betaSessionId), capped: true });
  }

  private save(state: RecordingState) {
    this.memory = state;
    try {
      this.storage?.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // 저장 실패는 녹화를 막지 않는다.
    }
  }
}

/** 조각 올리기 응답을 어떻게 다룰지. */
export type ChunkUploadOutcome = 'ok' | 'capped' | 'not-consented' | 'retry' | 'drop';

export const RECORDING_NOT_CONSENTED = 'RECORDING_NOT_CONSENTED';

export function chunkUploadOutcome(status: number, failureCode?: string | null): ChunkUploadOutcome {
  if (status >= 200 && status < 300) return 'ok';
  if (status === 413) return 'capped';
  if (status === 403 && failureCode === RECORDING_NOT_CONSENTED) return 'not-consented';
  if (status >= 500 || status === 429) return 'retry';
  return 'drop';
}

/**
 * 녹화를 해도 되는지 - 동의(허용)가 있고, 서버가 "동의 없음"(403 RECORDING_NOT_CONSENTED)으로 거절하지 않았을 때만.
 * 서버가 거절하면 이 화면에서는 다시 시작하지 않는다. 허용을 새로 받으면(꺼짐→켜짐) 거절을 잊는다.
 */
export class RecordingGate {
  private permitted = false;
  private refused = false;

  setPermitted(next: boolean) {
    if (next && !this.permitted) this.refused = false;
    this.permitted = next;
  }

  /** 응답을 보고 거절이면 막는다. 돌려준 값으로 올리기를 이어 갈지 정한다. */
  observe(status: number, failureCode?: string | null): ChunkUploadOutcome {
    const outcome = chunkUploadOutcome(status, failureCode);
    if (outcome === 'not-consented') this.refused = true;
    return outcome;
  }

  canRecord() {
    return this.permitted && !this.refused;
  }
}
