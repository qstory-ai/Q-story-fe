import { CompanionChatError } from '@/entities/companion-chat';

import type { AutoConfirmClock } from './auto-confirm';

/**
 * 그레텔 답을 기다리는 시간 제한. 서버 전체 요청 마감(REQUEST_TIMEOUT_MS, 40초)보다 짧게 둬서, 서버나 네트워크가
 * 멈췄을 때 아이가 "생각 중"을 40초씩 보지 않게 한다. 운영 지표 dialogue_step REPLY latency_ms를 보고 조정한다.
 * - FIRST: 답 문장(스트리밍 첫 줄)이 오기까지. 시도 장면 답은 문장이 먼저 오지 않고 장면 전체가 한 번에 오므로 여유를 둔다.
 * - REST: 답 문장이 온 뒤 나머지(태그·replyKind)까지. 넘기면 보인 문장으로만 마무리한다(오류 아님).
 */
export const REPLY_FIRST_TEXT_TIMEOUT_MS = 12_000;
export const REPLY_REST_TIMEOUT_MS = 12_000;

export const REPLY_TIMEOUT_CODE = 'REPLY_TIMEOUT';
/** 시간 안에 답이 안 왔을 때 패널에 보이는 말. 다시 말하기·글로 쓰기 버튼과 함께 나온다. */
export const REPLY_TIMEOUT_CHILD_COPY = '대답이 늦어지네. 한 번 더 말해 줄래?';

/**
 * 녹음 파일을 통째로 올려 받아 적는(배치 STT) 요청의 시간 제한. 실시간 받아 적기가 5초 안에 실패한 뒤의 두 번째 길이라
 * 여기까지 합치면 아이가 말을 마친 뒤 15초 안쪽에 결과나 안내를 본다.
 */
export const STT_BATCH_TIMEOUT_MS = 10_000;
export const STT_TIMEOUT_CODE = 'STT_TIMEOUT';
export const STT_TIMEOUT_CHILD_COPY = '잘 안 들렸어. 다시 말해 줄래?';

export function isTimeoutCode(error: unknown, code: string): error is CompanionChatError {
  return error instanceof CompanionChatError && error.code === code;
}

export function isReplyTimeout(error: unknown): error is CompanionChatError {
  return isTimeoutCode(error, REPLY_TIMEOUT_CODE);
}

const realClock: AutoConfirmClock = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
};

export type ReplyDeadline = {
  /** 시간이 다 되면 REPLY_TIMEOUT CompanionChatError로 거부된다. 요청과 Promise.race로 묶는다. */
  expired: Promise<never>;
  /** 답 문장이 왔다 - 나머지를 기다리는 시간으로 다시 잰다. */
  textArrived: () => void;
  /** 요청이 끝났다(성공·실패 모두). 더는 거부하지 않는다. */
  clear: () => void;
  /** 시간이 다 돼서 거부했는지. */
  expiredAlready: () => boolean;
};

export type ReplyDeadlineOptions = {
  firstMs?: number;
  restMs?: number;
  /** 거부할 때 쓰는 오류 코드와 아이에게 보이는 말 - 기본은 답 기다리기(REPLY_TIMEOUT). */
  code?: string;
  message?: string;
};

/**
 * 답 기다리기 시간 제한을 만든다. 만드는 순간부터 firstMs를 재고, textArrived() 뒤에는 restMs를 다시 잰다.
 * clear() 뒤에는 아무 일도 하지 않는다. 시계는 테스트에서 가짜로 바꿀 수 있다.
 */
export function createReplyDeadline(
  {
    firstMs = REPLY_FIRST_TEXT_TIMEOUT_MS,
    restMs = REPLY_REST_TIMEOUT_MS,
    code = REPLY_TIMEOUT_CODE,
    message = REPLY_TIMEOUT_CHILD_COPY,
  }: ReplyDeadlineOptions = {},
  clock: AutoConfirmClock = realClock,
): ReplyDeadline {
  let handle: unknown = null;
  let done = false;
  let expired = false;
  let reject: (error: CompanionChatError) => void = () => {};
  const expiredPromise = new Promise<never>((_, rejectFn) => {
    reject = rejectFn;
  });
  // race에서 지지 않아 아무도 안 붙잡아도 "unhandled rejection"이 되지 않게 미리 붙잡아 둔다.
  expiredPromise.catch(() => {});

  const stop = () => {
    if (handle !== null) {
      clock.clearTimeout(handle);
      handle = null;
    }
  };
  const arm = (ms: number) => {
    if (done) return;
    stop();
    handle = clock.setTimeout(() => {
      handle = null;
      if (done) return;
      done = true;
      expired = true;
      reject(new CompanionChatError(message, code, true));
    }, ms);
  };

  arm(firstMs);
  return {
    expired: expiredPromise,
    textArrived: () => arm(restMs),
    clear: () => {
      done = true;
      stop();
    },
    expiredAlready: () => expired,
  };
}
