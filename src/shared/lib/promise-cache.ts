/**
 * 같은 키의 GET을 화면마다 다시 보내지 않게 Promise를 잠깐 들고 있는 모듈 캐시. 진행 중인 요청은 함께 쓰고,
 * 끝난 응답은 ttlMs 동안 그대로 돌려준다. 실패한 요청은 남기지 않아 다음 호출이 다시 보낸다.
 * 바뀌는 즉시 보여야 하는 데이터(알림, 회차 기록)에는 쓰지 않는다.
 */
export function createPromiseCache<T>(ttlMs: number, now: () => number = Date.now) {
  const entries = new Map<string, { promise: Promise<T>; settledAt: number | null }>();
  return {
    get(key: string, load: () => Promise<T>): Promise<T> {
      const hit = entries.get(key);
      if (hit && (hit.settledAt === null || now() - hit.settledAt < ttlMs)) return hit.promise;
      const entry: { promise: Promise<T>; settledAt: number | null } = { promise: load(), settledAt: null };
      entries.set(key, entry);
      entry.promise.then(
        () => {
          entry.settledAt = now();
        },
        () => {
          if (entries.get(key) === entry) entries.delete(key);
        },
      );
      return entry.promise;
    },
    clear(): void {
      entries.clear();
    },
  };
}
