/**
 * 완주 기록 저장 - 교실 와이파이처럼 연결이 잠깐 끊겨도 기록이 사라지지 않게 몇 번 더 시도한다. 서버는 같은 회차
 * (conversationId)의 기록을 새로 만들지 않고 갱신하므로(be 053 멱등 저장) 다시 보내도 기록·알림이 겹치지 않는다.
 * 그래도 실패하면 완주 화면이 알리고 [다시 저장하기]를 준다(10/19 QA - 저장 실패가 화면에 드러나지 않았다).
 */
export type CompletionSaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

/** 첫 시도가 실패한 뒤 기다렸다 다시 보내는 간격 - 마지막 시도까지 실패하면 실패로 본다. */
export const COMPLETION_SAVE_RETRY_DELAYS_MS: readonly number[] = [2_000, 5_000];

export async function saveWithRetry<T>(
  save: () => Promise<T>,
  retryDelaysMs: readonly number[] = COMPLETION_SAVE_RETRY_DELAYS_MS,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    if (attempt > 0) await wait(retryDelaysMs[attempt - 1]);
    try {
      return await save();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
