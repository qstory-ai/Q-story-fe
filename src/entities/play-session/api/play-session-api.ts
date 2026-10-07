import { apiBaseUrl } from '@/shared/config';
import { requestJson, type PublicRequestOptions as RequestOptions } from '@/shared/api';

import type { PlayTurnBatch } from '../model/types';

export class PlaySessionApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

/**
 * 회차의 대화 줄을 한 묶음 보낸다(최대 50줄). 서버는 (sessionId, seq)로 멱등이라 같은 줄을 다시 보내도
 * 중복되지 않는다 - 실패하면 기록기가 다음에 같은 줄을 그대로 다시 보낸다.
 */
export function appendPlaySessionTurns(
  token: string,
  sessionId: string,
  batch: PlayTurnBatch,
  options?: RequestOptions,
): Promise<{ ok: boolean; savedThrough: number }> {
  return requestJson(
    PlaySessionApiError,
    `/v1/play-sessions/${encodeURIComponent(sessionId)}/turns`,
    { method: 'POST', body: JSON.stringify(batch) },
    { baseUrl: apiBaseUrl, ...options, token },
  );
}
