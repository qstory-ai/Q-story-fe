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

export function listRecordedChunks(token: string, betaSessionId: string): Promise<{ chunks: RecordedChunk[] }> {
  return requestJson(
    SessionRecordingApiError,
    `/v1/admin/session-recordings/${encodeURIComponent(betaSessionId)}/chunks`,
    { method: 'GET' },
    { baseUrl: apiBaseUrl, token },
  );
}
