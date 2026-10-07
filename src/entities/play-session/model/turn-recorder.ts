import type { PlaySessionContext, PlayTurn, PlayTurnBatch, PlayTurnInput } from './types';

export const TURN_BATCH_LIMIT = 50;
export const TURN_TEXT_LIMIT = 500;
export const TURN_FLUSH_DEBOUNCE_MS = 1_500;

type Timer = unknown;

export type TurnRecorderOptions = {
  /** 한 묶음을 서버로 보낸다. 실패하면 throw - 그 줄들은 다음 flush에서 다시 보낸다. */
  send: (sessionId: string, batch: PlayTurnBatch) => Promise<void>;
  debounceMs?: number;
  batchLimit?: number;
  schedule?: (callback: () => void, ms: number) => Timer;
  cancel?: (timer: Timer) => void;
  now?: () => Date;
};

/**
 * 한 회차의 대화 줄에 순서(seq)를 붙여 모아 두었다가 몇 초에 한 번 묶어 보낸다(Q-39).
 * - 화면을 막지 않는다: 보내기 실패는 조용히 쌓아 두고 다음 flush에서 다시 보낸다.
 * - seq는 회차 안에서 계속 늘어난다. "이어서 읽기"는 저장해 둔 다음 seq부터 이어 간다(startSession).
 * - 보낼 곳이 없으면(로그인 안 한 데모) 줄은 화면용으로만 모은다(enabled=false).
 * - 모든 줄은 history에 남겨, 서버 응답을 기다리지 않고 방금 끝난 회차의 리포트를 그릴 수 있게 한다.
 */
export class TurnRecorder {
  private readonly options: Required<Omit<TurnRecorderOptions, 'send'>> & Pick<TurnRecorderOptions, 'send'>;
  private sessionIdValue: string;
  private nextSeqValue: number;
  private context: PlaySessionContext;
  private queue: PlayTurn[] = [];
  private historyValue: PlayTurn[] = [];
  private timer: Timer | null = null;
  private inFlight: Promise<void> | null = null;
  enabled: boolean;

  constructor(sessionId: string, context: PlaySessionContext, options: TurnRecorderOptions, enabled = true) {
    this.options = {
      debounceMs: TURN_FLUSH_DEBOUNCE_MS,
      batchLimit: TURN_BATCH_LIMIT,
      schedule: (callback, ms) => setTimeout(callback, ms),
      cancel: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
      now: () => new Date(),
      ...options,
    };
    this.sessionIdValue = sessionId;
    this.nextSeqValue = 1;
    this.context = context;
    this.enabled = enabled;
  }

  get sessionId() {
    return this.sessionIdValue;
  }

  /** 다음에 붙일 seq - 이어서 읽기를 위해 진행 저장에 함께 남긴다. */
  get nextSeq() {
    return this.nextSeqValue;
  }

  get pendingCount() {
    return this.queue.length;
  }

  /** 이 화면에서 기록한 줄 전부(이어서 읽기 전 줄은 서버에만 있다). */
  get history(): readonly PlayTurn[] {
    return this.historyValue;
  }

  setContext(patch: Partial<PlaySessionContext>) {
    this.context = { ...this.context, ...patch };
  }

  /**
   * 새 회차를 시작하거나(처음부터 다시 읽기) 저장해 둔 회차를 이어 간다. 이전 회차의 남은 줄은 먼저 보낸다.
   */
  startSession(sessionId: string, nextSeq = 1) {
    if (sessionId === this.sessionIdValue && nextSeq <= this.nextSeqValue) return;
    // 앞 회차에 남은 줄은 그 회차 id·정보로 따로 보낸다(큐를 비우기 전에 떼어 둔다).
    const leftover = this.queue;
    if (this.enabled && leftover.length > 0 && sessionId !== this.sessionIdValue) {
      void this.sendDetached(this.sessionIdValue, this.context, leftover);
    }
    if (this.timer !== null) {
      this.options.cancel(this.timer);
      this.timer = null;
    }
    this.sessionIdValue = sessionId;
    this.nextSeqValue = Math.max(1, Math.floor(nextSeq));
    this.queue = [];
    this.historyValue = [];
  }

  record(input: PlayTurnInput): PlayTurn {
    const turn: PlayTurn = {
      ...input,
      seq: this.nextSeqValue,
      occurredAt: input.occurredAt ?? this.options.now().toISOString(),
      ...(input.text != null ? { text: input.text.slice(0, TURN_TEXT_LIMIT) } : {}),
    };
    this.nextSeqValue += 1;
    this.historyValue = [...this.historyValue, turn];
    if (this.enabled) {
      this.queue.push(turn);
      this.scheduleFlush();
    }
    return turn;
  }

  /** 지난 회차의 남은 줄 - 한 번만 보내 보고, 실패하면 버린다(다음 회차와 섞이지 않게). */
  private async sendDetached(sessionId: string, context: PlaySessionContext, turns: PlayTurn[]) {
    for (let index = 0; index < turns.length; index += this.options.batchLimit) {
      try {
        await this.options.send(sessionId, { ...context, turns: turns.slice(index, index + this.options.batchLimit) });
      } catch {
        return;
      }
    }
  }

  private scheduleFlush() {
    if (this.timer !== null) this.options.cancel(this.timer);
    this.timer = this.options.schedule(() => {
      this.timer = null;
      void this.flush();
    }, this.options.debounceMs);
  }

  /** 쌓인 줄을 묶음 단위로 보낸다. 이미 보내는 중이면 그 뒤에 이어서 보낸다. 실패해도 throw하지 않는다. */
  flush(): Promise<void> {
    if (this.timer !== null) {
      this.options.cancel(this.timer);
      this.timer = null;
    }
    const run = async () => {
      while (this.enabled && this.queue.length > 0) {
        const sessionId = this.sessionIdValue;
        const turns = this.queue.slice(0, this.options.batchLimit);
        try {
          await this.options.send(sessionId, { ...this.context, turns });
        } catch {
          return; // 다음 flush에서 같은 줄을 다시 보낸다(서버가 seq로 중복을 거른다).
        }
        // 보내는 동안 회차가 바뀌었으면 새 회차 큐는 건드리지 않는다.
        if (sessionId !== this.sessionIdValue) return;
        const sent = new Set(turns.map((turn) => turn.seq));
        this.queue = this.queue.filter((turn) => !sent.has(turn.seq));
      }
    };
    const chained = (this.inFlight ?? Promise.resolve()).then(run, run);
    const tracked: Promise<void> = chained.finally(() => {
      if (this.inFlight === tracked) this.inFlight = null;
    });
    this.inFlight = tracked;
    return tracked;
  }
}
