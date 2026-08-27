import { speechApiUrl } from '@/entities/speech-pipeline';

export type LiveBranchJobStatus = 'QUEUED' | 'GENERATING' | 'READY' | 'FAILED';

/**
 * READY일 때 돌려주는 옵션 하나. Phase 2부터는 새로 생성된 family + 모자란 자리를 채운 기존
 * family를 합쳐 항상 정확히 3개가 온다(§3 새 선택지 생성 참고) - Phase 1의 단일
 * resultFamilyId를 대체한다.
 */
export type LiveBranchOption = {
  familyId: string;
  label: string;
  meaning: string;
};

export type LiveBranchJobStatusResponse = {
  status: LiveBranchJobStatus;
  /** READY일 때만 채워지며, 항상 정확히 3개다. */
  options?: LiveBranchOption[];
  errorCode?: string;
};

type RequestOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

const LIVE_BRANCH_JOB_STATUSES = new Set<LiveBranchJobStatus>([
  'QUEUED',
  'GENERATING',
  'READY',
  'FAILED',
]);

export class LiveBranchApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

function isLiveBranchOption(value: unknown): value is LiveBranchOption {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.familyId === 'string' &&
    typeof candidate.label === 'string' &&
    typeof candidate.meaning === 'string'
  );
}

function isLiveBranchJobStatusResponse(
  value: unknown,
): value is LiveBranchJobStatusResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.status !== 'string' ||
    !LIVE_BRANCH_JOB_STATUSES.has(candidate.status as LiveBranchJobStatus)
  ) {
    return false;
  }
  if (candidate.options === undefined) {
    return true;
  }
  return (
    Array.isArray(candidate.options) &&
    candidate.options.every(isLiveBranchOption)
  );
}

/**
 * GET /v1/live-branch/{jobId} - 아이 질문이 기존 선택지 어디에도 맞지 않아 백엔드가 실시간(비동기)
 * 새 분기 생성을 큐에 넣었을 때(RoutePlan.liveBranchJobId), 그 작업의 진행 상태를 폴링한다.
 * /v1/questions/route, GET /v1/stories/{storyId}/content와 마찬가지로 인증이 필요 없는 공개
 * 엔드포인트다 - use-one-story-runtime.ts의 폴링 effect에서만 호출한다.
 */
export async function getLiveBranchJobStatus(
  jobId: string,
  signal: AbortSignal,
  { baseUrl = speechApiUrl, fetchImpl = fetch }: RequestOptions = {},
): Promise<LiveBranchJobStatusResponse> {
  if (!baseUrl) {
    throw new LiveBranchApiError(
      '이야기 서버 주소가 설정되지 않았어요. (VITE_QSTORY_API_URL)',
    );
  }
  const response = await fetchImpl.call(
    globalThis,
    `${baseUrl}/v1/live-branch/${jobId}`,
    { signal },
  );
  if (!response.ok) {
    throw new LiveBranchApiError(
      `실시간 분기 상태를 확인하지 못했어요. (HTTP ${response.status})`,
      response.status,
    );
  }
  const payload: unknown = await response.json();
  if (!isLiveBranchJobStatusResponse(payload)) {
    throw new LiveBranchApiError('실시간 분기 상태 응답 형식이 올바르지 않아요.');
  }
  return payload;
}
