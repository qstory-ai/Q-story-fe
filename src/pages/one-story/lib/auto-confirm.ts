export type AutoConfirmClock = {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  now: () => number;
};

const realClock: AutoConfirmClock = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
};

/**
 * 자동 확인 카운트다운. start() 후 delayMs가 지나면 onConfirm을 정확히 한 번 호출하고,
 * cancel() 하면 호출하지 않는다. 시계는 테스트에서 가짜로 바꿀 수 있다.
 */
export function createAutoConfirm(
  delayMs: number,
  onConfirm: () => void,
  clock: AutoConfirmClock = realClock,
) {
  let handle: unknown = null;
  let deadline = 0;

  function cancel() {
    if (handle !== null) {
      clock.clearTimeout(handle);
      handle = null;
    }
  }

  return {
    start() {
      cancel();
      deadline = clock.now() + delayMs;
      handle = clock.setTimeout(() => {
        handle = null;
        onConfirm();
      }, delayMs);
    },
    cancel,
    isActive: () => handle !== null,
    /** 남은 시간(ms). 활성 상태가 아니면 0. */
    remainingMs: () => (handle === null ? 0 : Math.max(0, deadline - clock.now())),
  };
}

export function countdownSeconds(remainingMs: number): number {
  return Math.max(0, Math.ceil(remainingMs / 1000));
}
