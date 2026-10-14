/**
 * 스트리밍 PCM(Gemini TTS) 재생의 지터 버퍼 - 언제 소리를 시작(또는 끊긴 뒤 다시 시작)할지 정하는 순수 함수.
 *
 * 운영에서 답 음성 조각은 실시간보다 느리게 올 때가 있다(2026-10 실측: 0.24초 분량이 0.3~0.9초마다, 한 번은 첫 소리
 * 뒤 8초 멈춤). 첫 조각이 오자마자 틀면 버퍼가 없어 문장 중간에 끊긴다. 그래서 들어오는 속도(받은 소리 초 / 흐른 초)와
 * 남은 분량(문장 길이로 어림)을 보고, 끝까지 끊기지 않을 만큼 모였을 때 시작한다 - 단, 첫 소리가 너무 늦어지지 않게
 * 기다림에 상한을 둔다(채움말이 소리를 내는 동안은 그 소리가 기다림을 가려 주므로 상한을 미룬다).
 */

/** 처음 시작할 때 최소로 모아 둘 소리(초). */
export const JITTER_START_MIN_SECONDS = 0.6;
/** 끊긴 뒤 다시 시작할 때 최소로 모아 둘 소리(초) - 짧은 토막을 틀었다 끊었다 하지 않게. */
export const JITTER_RESUME_MIN_SECONDS = 0.8;
/** 남은 분량을 다 받기까지의 부족분에 더하는 여유(초). */
export const JITTER_SAFETY_SECONDS = 0.3;
/** 첫 조각이 온 뒤 첫 소리까지 최대로 기다리는 시간(초) - 채움말이 소리를 내는 동안은 세지 않는다. */
export const JITTER_START_MAX_WAIT_SECONDS = 2.5;
/** 끊긴 뒤 다시 시작하기까지 최대로 기다리는 시간(초). */
export const JITTER_RESUME_MAX_WAIT_SECONDS = 2.5;
/**
 * 들어오는 속도를 어림할 때 흐른 시간에 더하는 값(초) - 첫 조각 직후 "0.1초에 0.12초 분량 = 빠르다"처럼 너무 낙관하지 않게
 * 처음엔 느리다고 보고, 시간이 지날수록 실제 속도에 가까워진다.
 */
export const JITTER_RATE_PRIOR_SECONDS = 0.25;
/** 문장 길이를 모를 때 남은 분량으로 삼는 값(초). */
export const JITTER_UNKNOWN_REMAINING_SECONDS = 4;

export type JitterBufferState = {
  /** 'start': 아직 소리를 내지 않았다. 'resume': 재생하다 소리가 떨어져 멈췄다. */
  phase: 'start' | 'resume';
  /** 받았지만 아직 재생하지 않은 소리(초). */
  bufferedSeconds: number;
  /** 지금까지 받은 소리 전체(초). */
  receivedSeconds: number;
  /** 첫 조각이 온 뒤 흐른 시간(초, 벽시계). */
  sinceFirstChunkSeconds: number;
  /** 이번 기다림이 시작된 뒤 흐른 시간(초) - start면 첫 조각부터, resume이면 소리가 떨어진 때부터. */
  waitingSeconds: number;
  /** 문장 전체 소리 길이 어림(초). 모르면 null. */
  estimatedTotalSeconds: number | null;
  /** 스트림이 끝났다 - 더 올 게 없으니 남은 걸 바로 튼다. */
  streamEnded: boolean;
  /** 채움말이 지금 소리를 내는 중이다 - 기다림 상한을 미룬다. */
  coveredByFiller?: boolean;
};

/** 들어오는 속도(받은 소리 초 / 흐른 초) - 처음엔 느리게 본다(JITTER_RATE_PRIOR_SECONDS). */
export function estimateArrivalRate(receivedSeconds: number, sinceFirstChunkSeconds: number) {
  return receivedSeconds / (Math.max(0, sinceFirstChunkSeconds) + JITTER_RATE_PRIOR_SECONDS);
}

/** 지금 시작하면 끝까지 끊기지 않으려면 모아 둬야 할 소리(초). */
export function requiredBufferSeconds(state: JitterBufferState) {
  const floor = state.phase === 'start' ? JITTER_START_MIN_SECONDS : JITTER_RESUME_MIN_SECONDS;
  const rate = estimateArrivalRate(state.receivedSeconds, state.sinceFirstChunkSeconds);
  const remaining =
    state.estimatedTotalSeconds === null
      ? JITTER_UNKNOWN_REMAINING_SECONDS
      : // 어림보다 이미 많이 받았으면 어림이 짧았던 것 - 조금은 더 온다고 본다.
        Math.max(0.5, state.estimatedTotalSeconds - state.receivedSeconds);
  // 남은 분량을 재생하는 동안 rate 배로 들어온다 - 모자라는 만큼(remaining × (1 − rate))을 미리 모아 둔다.
  return Math.max(floor, remaining * (1 - Math.min(1, rate)) + JITTER_SAFETY_SECONDS);
}

/** 지금 소리를 (다시) 시작할지. */
export function shouldStartPlayback(state: JitterBufferState): boolean {
  if (state.bufferedSeconds <= 0) return false;
  if (state.streamEnded) return true;
  if (state.bufferedSeconds >= requiredBufferSeconds(state)) return true;
  if (state.coveredByFiller) return false;
  const maxWait = state.phase === 'start' ? JITTER_START_MAX_WAIT_SECONDS : JITTER_RESUME_MAX_WAIT_SECONDS;
  // 상한이 지나도 다시 시작할 땐 최소 분량은 채운다 - 0.1초 토막만 틀고 또 끊기지 않게.
  if (state.phase === 'resume' && state.bufferedSeconds < JITTER_RESUME_MIN_SECONDS) return false;
  return state.waitingSeconds >= maxWait;
}

/**
 * 그레텔 목소리(Gemini TTS)로 이 문장을 읽는 데 걸리는 시간(초) 어림. 2026-10 운영 실측: 한글 39~51자 + 문장부호 4개
 * 문장이 10.5~10.9초(쉼표·물음표 뒤 쉼 포함, 초당 약 3.6~4.7자) - 일반 낭독(초당 6~7자)보다 느리다.
 * 길게 어림하면 조금 더 모으고(상한이 있다), 짧게 어림하면 끊길 수 있으니 느린 쪽에 맞춘다.
 */
export function estimateReplySpeechSeconds(text: string) {
  const syllables = (text.match(/[가-힣]/g) ?? []).length;
  const others = (text.match(/[A-Za-z0-9]/g) ?? []).length;
  const pauses = (text.match(/[,.!?…~]+/g) ?? []).length;
  return 0.4 + syllables / 4.3 + others / 8 + pauses * 0.25;
}
