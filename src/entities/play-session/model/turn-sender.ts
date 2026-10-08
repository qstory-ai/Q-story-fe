import type { PlayTurnBatch } from './types';

export type TurnSenderDeps = {
  /** 지금 로그인 토큰 - 없으면 익명으로 보낸다. */
  getToken: () => string | null;
  getBetaSessionId: () => string;
  append: (token: string | null, sessionId: string, batch: PlayTurnBatch) => Promise<unknown>;
};

/**
 * 대화 기록기의 send - 로그인했으면 토큰을 싣고, 아니면 익명으로 보낸다. 통계 세션 id는 늘 함께 보낸다
 * (로그인 전 데모 회차도 UT 기록에 남기고, 중간에 로그인하면 서버가 앞부분을 계정에 잇는다).
 */
export function createTurnSender({ getToken, getBetaSessionId, append }: TurnSenderDeps) {
  return (sessionId: string, batch: PlayTurnBatch): Promise<void> =>
    append(getToken(), sessionId, { ...batch, betaSessionId: getBetaSessionId() }).then(() => undefined);
}
