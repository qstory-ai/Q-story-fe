import { readEnv } from '@/shared/config';
import type { QuestionOutcome } from '@/entities/analytics';

const apiBaseUrl = readEnv('VITE_QSTORY_API_URL');

export type StoryCompletionSummary = {
  id: string;
  storyId: string;
  completedAt: string;
  durationSeconds: number | null;
};

export type StoryCompletionDetail = StoryCompletionSummary & {
  outcomes: QuestionOutcome[];
};

type RequestOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

/** auth-api.ts의 request<T>()를 작게 로컬로 복제한 것 - 왜 공유하지 않는지는 story-api.ts의 자체 사본을 참고. */
export class StoryCompletionApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  init: RequestInit,
  token: string,
  { baseUrl = apiBaseUrl, fetchImpl = fetch }: RequestOptions = {},
): Promise<T> {
  if (!baseUrl) {
    throw new StoryCompletionApiError('VITE_QSTORY_API_URL is not configured.');
  }
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('Authorization', `Bearer ${token}`);

  const response = await fetchImpl.call(globalThis, `${baseUrl}${path}`, { ...init, headers });
  if (!response.ok) {
    let code: string | undefined;
    let safeDetail: string | undefined;
    try {
      const body = (await response.json()) as { failure?: { code?: string; safeDetail?: string } };
      code = body.failure?.code;
      safeDetail = body.failure?.safeDetail;
    } catch {
      // 실패 응답 본문을 읽지 못하면 아래 기본 메시지로 대체한다.
    }
    throw new StoryCompletionApiError(safeDetail ?? `요청을 처리하지 못했어요. (HTTP ${response.status})`, code, response.status);
  }
  return (await response.json()) as T;
}

/**
 * 방금 끝난 세션의 리포트를 저장한다. outcomes는 실시간 리포트 화면이 이미 구성해 둔 것과 동일한
 * QuestionOutcome[]이다. tutorStudentId는 선택값 - 방문 선생님이 자신이 등록한 학생과 진행한
 * 세션일 때만 넘긴다(StoryPlayerRoute의 ?tutorStudentId= 참고); 가정에서 본 세션은 생략한다.
 */
export function recordStoryCompletion(
  token: string,
  input: { storyId: string; durationSeconds: number | null; outcomes: QuestionOutcome[]; tutorStudentId?: string },
  options?: RequestOptions,
): Promise<StoryCompletionSummary> {
  return request('/v1/story-completions', { method: 'POST', body: JSON.stringify(input) }, token, options);
}

export function listStoryCompletions(token: string, options?: RequestOptions): Promise<StoryCompletionSummary[]> {
  return request('/v1/story-completions', { method: 'GET' }, token, options);
}

export function getStoryCompletion(
  token: string,
  id: string,
  options?: RequestOptions,
): Promise<StoryCompletionDetail> {
  return request(`/v1/story-completions/${id}`, { method: 'GET' }, token, options);
}
