import { apiBaseUrl } from '@/shared/config';

export type RealtimeImageStatus = 'QUEUED' | 'GENERATING' | 'READY' | 'FAILED';

export type RealtimeImageStatusResponse = {
  status: RealtimeImageStatus;
  /** READY일 때만. */
  imageUrl?: string;
  errorCode?: string;
};

const STATUSES = new Set<RealtimeImageStatus>(['QUEUED', 'GENERATING', 'READY', 'FAILED']);

function isRealtimeImageStatusResponse(value: unknown): value is RealtimeImageStatusResponse {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.status === 'string' &&
    STATUSES.has(candidate.status as RealtimeImageStatus) &&
    (candidate.imageUrl === undefined || typeof candidate.imageUrl === 'string')
  );
}

/**
 * GET /v1/realtime-images/{id} - 시도 장면 막힌 그림을 서버가 아이 말대로 실시간으로 만드는 동안(companion-chat 응답의
 * dialogue.attempt.imageJobId) 완성됐는지 묻는다. 공개 엔드포인트, 그림 주소만 돌려준다.
 */
export async function getRealtimeImageStatus(
  id: string,
  signal: AbortSignal,
  { baseUrl = apiBaseUrl, fetchImpl = fetch }: { baseUrl?: string; fetchImpl?: typeof fetch } = {},
): Promise<RealtimeImageStatusResponse> {
  if (!baseUrl) throw new Error('이야기 서버 주소가 설정되지 않았어요. (VITE_QSTORY_API_URL)');
  const response = await fetchImpl.call(globalThis, `${baseUrl}/v1/realtime-images/${id}`, { signal });
  if (!response.ok) throw new Error(`실시간 그림 상태를 확인하지 못했어요. (HTTP ${response.status})`);
  const payload: unknown = await response.json();
  if (!isRealtimeImageStatusResponse(payload)) throw new Error('실시간 그림 상태 응답 형식이 올바르지 않아요.');
  return payload;
}

/** 폴링 간격·상한 - 2k 그림은 보통 20~50초, 시도 장면(최대 4턴)은 1~2분 이어진다. */
export const REALTIME_IMAGE_POLL_INTERVAL_MS = 3_000;
export const REALTIME_IMAGE_POLL_TIMEOUT_MS = 120_000;

/**
 * 완성될 때까지 기다렸다가 그림 주소를 돌려준다. 실패·상한·중단이면 null - 호출자는 그냥 원래 그림을 둔다.
 * 한 번의 조회 실패(네트워크 끊김 등)는 다음 간격에 다시 묻는다.
 */
export async function waitForRealtimeImage(
  id: string,
  signal: AbortSignal,
  options: { intervalMs?: number; timeoutMs?: number; baseUrl?: string; fetchImpl?: typeof fetch } = {},
): Promise<string | null> {
  const interval = options.intervalMs ?? REALTIME_IMAGE_POLL_INTERVAL_MS;
  const timeout = options.timeoutMs ?? REALTIME_IMAGE_POLL_TIMEOUT_MS;
  const startedAt = Date.now();
  while (!signal.aborted && Date.now() - startedAt < timeout) {
    try {
      const status = await getRealtimeImageStatus(id, signal, options);
      if (status.status === 'READY' && status.imageUrl) return status.imageUrl;
      if (status.status === 'FAILED') return null;
    } catch {
      if (signal.aborted) return null;
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, interval);
      signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
    });
  }
  return null;
}
