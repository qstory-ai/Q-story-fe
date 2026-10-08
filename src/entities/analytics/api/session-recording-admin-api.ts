import { requestJson } from '@/shared/api';
import { apiBaseUrl } from '@/shared/config';

/** 팀 내부 화면 녹화 다시 보기(STAFF만) - 회차·통계 세션 코드로 녹화를 찾고 조각을 받아 온다. */
export type RecordedSession = {
  betaSessionId: string;
  betaSessionCode: string;
  playSessionIds: string[];
  startedAt: string;
  endedAt: string;
  chunkCount: number;
  totalBytes: number;
  userId: string | null;
};

export type RecordedChunk = {
  seq: number;
  startedAt: string;
  endedAt: string;
  eventCount: number;
  encoding: string;
  data: string;
};

export class SessionRecordingApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

export function findRecordedSessions(token: string, code: string): Promise<RecordedSession[]> {
  return requestJson(
    SessionRecordingApiError,
    `/v1/admin/session-recordings?code=${encodeURIComponent(code)}`,
    { method: 'GET' },
    { baseUrl: apiBaseUrl, token },
  );
}

/**
 * 조각 전부를 받아 온다. 서버는 프록시 응답 한도(4.5MB) 때문에 약 2.5MB씩 끊어 주므로 nextAfterSeq를 따라 이어 받는다.
 */
export async function listRecordedChunks(token: string, betaSessionId: string): Promise<{ chunks: RecordedChunk[] }> {
  const chunks: RecordedChunk[] = [];
  let afterSeq: number | null = -1;
  // 페이지 수 상한 - 50MB 세션도 25쪽 안팎이라 넉넉히 둔다(서버가 같은 값을 돌려줘도 무한 반복하지 않게).
  for (let page = 0; afterSeq !== null && page < 100; page += 1) {
    const response: { chunks: RecordedChunk[]; nextAfterSeq?: number | null } = await requestJson(
      SessionRecordingApiError,
      `/v1/admin/session-recordings/${encodeURIComponent(betaSessionId)}/chunks?afterSeq=${afterSeq}`,
      { method: 'GET' },
      { baseUrl: apiBaseUrl, token },
    );
    chunks.push(...response.chunks);
    const next: number | null = response.nextAfterSeq ?? null;
    afterSeq = next !== null && next > afterSeq ? next : null;
  }
  return { chunks };
}
