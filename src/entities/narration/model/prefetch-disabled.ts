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
