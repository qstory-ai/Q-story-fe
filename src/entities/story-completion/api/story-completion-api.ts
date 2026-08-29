import { apiBaseUrl } from '@/shared/config';
import { requestJson, type PublicRequestOptions as RequestOptions } from '@/shared/api';
import type { QuestionOutcome } from '@/entities/analytics';

export type StoryCompletionSummary = {
  id: string;
  storyId: string;
  completedAt: string;
  durationSeconds: number | null;
};

export type StoryCompletionDetail = StoryCompletionSummary & {
  outcomes: QuestionOutcome[];
};

export class StoryCompletionApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

function request<T>(path: string, init: RequestInit, token: string, options: RequestOptions = {}): Promise<T> {
  return requestJson(StoryCompletionApiError, path, init, { baseUrl: apiBaseUrl, ...options, token });
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

/** 최근 N회의 전체 리포트를 outcomes와 함께 가져온다 - 목록 화면의 누적 트렌드 카드(buildRecentApproachTrend)용. */
export function listRecentStoryCompletions(
  token: string,
  limit: number,
  options?: RequestOptions,
): Promise<StoryCompletionDetail[]> {
  return request(`/v1/story-completions/recent?limit=${limit}`, { method: 'GET' }, token, options);
}
