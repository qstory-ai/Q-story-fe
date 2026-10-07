/** 서버가 prefetch를 꺼 둔 경우(409 PREFETCH_DISABLED) fetcher가 던진다 - 세션 내내 prefetch를 멈춘다. */
export class PrefetchDisabledError extends Error {
  constructor() {
    super('PREFETCH_DISABLED');
    this.name = 'PrefetchDisabledError';
  }
}

export type ChoicePrefetchItem = { id: string; text: string };

type Entry<T> = {
  controller: AbortController;
  audio: T | null;
  settled: boolean;
};

type Fetcher<T> = (item: ChoicePrefetchItem, signal: AbortSignal) => Promise<T | null>;

type Options<T> = {
  /** 기본 fetcher. 실패는 null, 서버가 꺼졌으면 PrefetchDisabledError. start에서 덮어쓸 수 있다. */
  fetcher?: Fetcher<T>;
  /** 쓰이지 못하고 버려지는 음성 정리(스트림 cancel 등). */
  dispose?: (audio: T) => void;
  maxItems?: number;
};

/**
 * 선택지 음성 미리 만들기 캐시. 선택지 id로 캐시하고, 409 이후 재요청하지 않고,
 * 이탈(abort) 시 남은 요청을 취소한다. 실패한 prefetch는 재시도하지 않는다.
 */
export function createChoicePrefetcher<T>({ fetcher: defaultFetcher, dispose, maxItems = 3 }: Options<T> = {}) {
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
      const entry: Entry<T> = { controller: new AbortController(), audio: null, settled: false };
      current.set(item.id, entry);
      fetcher(item, entry.controller.signal).then(
        (audio) => {
          entry.settled = true;
          if (entry.controller.signal.aborted || current.get(item.id) !== entry) {
            if (audio) dispose?.(audio);
            return;
          }
          entry.audio = audio;
        },
        (error) => {
          entry.settled = true;
          if (error instanceof PrefetchDisabledError) {
            disabled = true;
            if (entries === current) abort();
          }
        },
      );
    }
  }

  /** 준비된 음성을 꺼내 준다(한 번만). 아직 준비 중이거나 없으면 null - 호출자가 기존 요청으로 폴백. */
  function take(id: string): T | null {
    const entry = entries.get(id);
    if (!entry || !entry.audio) return null;
    entries.delete(id);
    const audio = entry.audio;
    entry.audio = null;
    return audio;
  }

  return { start, take, abort, isDisabled: () => disabled };
}
