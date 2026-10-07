export type NoSpeechClock = {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  now: () => number;
};

const realClock: NoSpeechClock = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
};

export const NO_SPEECH_WAIT_MS = 15_000;

/**
 * 무응답 처리(Q-34). 마이크가 켜진 뒤 firstWaitMs 동안 말이 없으면 onReprompt를 한 번 부르고,
 * 그 뒤 secondWaitMs 동안도 없으면 onGiveUp을 부른다. speechDetected()·cancel()이면 둘 다 멈춘다.
 */
export function createNoSpeechTimer(
  handlers: { onReprompt: () => void; onGiveUp: () => void },
  {
    firstWaitMs = NO_SPEECH_WAIT_MS,
    secondWaitMs = NO_SPEECH_WAIT_MS,
  }: { firstWaitMs?: number; secondWaitMs?: number } = {},
  clock: NoSpeechClock = realClock,
) {
  let handle: unknown = null;

  function cancel() {
    if (handle !== null) {
      clock.clearTimeout(handle);
      handle = null;
    }
  }

  return {
    start() {
      cancel();
      handle = clock.setTimeout(() => {
        handle = clock.setTimeout(() => {
          handle = null;
          handlers.onGiveUp();
        }, secondWaitMs);
        handlers.onReprompt();
      }, firstWaitMs);
    },
    speechDetected: cancel,
    cancel,
    isActive: () => handle !== null,
  };
}
