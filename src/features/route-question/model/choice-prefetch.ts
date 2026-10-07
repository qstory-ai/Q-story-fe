/** 서버가 prefetch를 꺼 둔 경우(409 PREFETCH_DISABLED) fetcher가 던진다 - 세션 내내 prefetch를 멈춘다. */
export class PrefetchDisabledError extends Error {
  constructor() {
    super('PREFETCH_DISABLED');
    this.name = 'PrefetchDisabledError';
  }
}

/** FailureBody `{ok:false,failure:{code}}`(최상위 `code`도 허용)에서 prefetch 비활성 여부를 판정한다. */
export function isPrefetchDisabledBody(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const record = body as { code?: unknown; failure?: { code?: unknown } | null };
  return record.failure?.code === 'PREFETCH_DISABLED' || record.code === 'PREFETCH_DISABLED';
}

export type ChoicePrefetchItem = { id: string; text: string };

type Entry<T> = {
  controller: AbortController;
  /** 끝나면 음성(실패는 null)으로 이행한다. 절대 reject하지 않는다. */
  promise: Promise<T | null>;
  audio: T | null;
  settled: boolean;
  taken: boolean;
};

type Fetcher<T> = (item: ChoicePrefetchItem, signal: AbortSignal) => Promise<T | null>;

type Options<T> = {
  /** 기본 fetcher. 실패는 null, 서버가 꺼졌으면 PrefetchDisabledError. start에서 덮어쓸 수 있다. */
  fetcher?: Fetcher<T>;
  /** 쓰이지 못하고 버려지는 음성 정리(스트림 cancel 등). */
  dispose?: (audio: T) => void;
  maxItems?: number;
};

export type AwaitedPrefetch<T> = {
  audio: T | null;
  /** true면 시간 안에 못 끝났다 - 호출자는 폴백 요청을 새로 시작하지 않는다. */
  timedOut: boolean;
  elapsedMs: number;
};

export type TakenPrefetch<T> = {
  /** 이미 준비된 음성. */
  audio: T | null;
  /** 아직 준비 중이면 그 약속(null=실패). audio가 있으면 null. */
  pending: Promise<T | null> | null;
};

/**
 * 선택지 음성 미리 만들기 캐시. 선택지 id로 캐시하고, 409 이후 재요청하지 않고,
 * 이탈(abort) 시 남은 요청을 취소한다. 실패한 prefetch는 재시도하지 않는다.
 */
export function createChoicePrefetcher<T>({
  fetcher: defaultFetcher,
  dispose,
  maxItems = 3,
}: Options<T> = {}) {
  let disabled = false;
  let entries = new Map<string, Entry<T>>();

  function discard(entry: Entry<T>) {
    entry.controller.abort();
    if (entry.audio) dispose?.(entry.audio);
    entry.audio = null;
  }

  function abort() {
    const old = entries;
    entries = new Map();
    old.forEach(discard);
  }

  function start(items: ChoicePrefetchItem[], fetcherOverride?: Fetcher<T>) {
    const fetcher = fetcherOverride ?? defaultFetcher;
    if (disabled || !fetcher) return;
    abort();
    const current = new Map<string, Entry<T>>();
    entries = current;
    for (const item of items.slice(0, maxItems)) {
      if (!item.text) continue;
      const controller = new AbortController();
      const entry: Entry<T> = {
        controller,
        audio: null,
        settled: false,
        taken: false,
        promise: Promise.resolve(null),
      };
      entry.promise = fetcher(item, controller.signal).then(
        (audio) => {
          entry.settled = true;
          if (entry.taken) return audio;
          if (controller.signal.aborted || current.get(item.id) !== entry) {
            if (audio) dispose?.(audio);
            return null;
          }
          entry.audio = audio;
          return audio;
        },
        (error) => {
          entry.settled = true;
          if (error instanceof PrefetchDisabledError) {
            disabled = true;
            if (entries === current) abort();
          }
          return null;
        },
      );
      current.set(item.id, entry);
    }
  }

  /** 선택지 하나를 꺼낸다(한 번만). 이후 abort()는 이 항목을 취소하지 않는다. 없으면 null. */
  function take(id: string): TakenPrefetch<T> | null {
    const entry = entries.get(id);
    if (!entry) return null;
    entries.delete(id);
    entry.taken = true;
    const audio = entry.audio;
    entry.audio = null;
    if (audio) return { audio, pending: null };
    if (entry.settled) return null;
    return { audio: null, pending: entry.promise };
  }

  /**
   * 꺼낸 항목을 최대 waitMs 기다린다. 실패는 audio:null(빠른 실패면 호출자가 남은 시간으로 폴백), 시간초과는 timedOut:true.
   * 시간초과 뒤 늦게 도착한 음성은 정리한다.
   */
  async function awaitTaken(
    taken: TakenPrefetch<T>,
    waitMs: number,
    now: () => number = Date.now,
  ): Promise<AwaitedPrefetch<T>> {
    if (taken.audio) return { audio: taken.audio, timedOut: false, elapsedMs: 0 };
    if (!taken.pending) return { audio: null, timedOut: false, elapsedMs: 0 };
    const startedAt = now();
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => {
        timedOut = true;
        resolve(null);
      }, Math.max(0, waitMs));
    });
    const result = await Promise.race([taken.pending, timeout]);
    if (timer) clearTimeout(timer);
    if (timedOut) {
      void taken.pending.then((late) => {
        if (late) dispose?.(late);
      });
      return { audio: null, timedOut: true, elapsedMs: now() - startedAt };
    }
    return { audio: result, timedOut: false, elapsedMs: now() - startedAt };
  }

  return { start, take, awaitTaken, abort, isDisabled: () => disabled };
}
