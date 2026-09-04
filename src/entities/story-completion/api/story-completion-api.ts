import { apiBaseUrl } from '@/shared/config';
import { requestJson, type PublicRequestOptions as RequestOptions } from '@/shared/api';
import type { QuestionOutcome } from '@/entities/analytics';

export type StoryCompletionSummary = {
  id: string;
  storyId: string;
  completedAt: string;
  durationSeconds: number | null;
  /**
   * 부모(PARENT) 계정에서 어느 아이 프로필로 진행한 세션인지 - 리포트 페이지의 아이별 필터에
   * 이 값이 있는 항목만 노출한다. 선생님 세션이나 legacy 기록(childName 시절)은 null.
   */
  childId: string | null;
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
 * QuestionOutcome[]이다.
 * - tutorStudentId: 선생님이 자신이 등록한 학생과 진행한 세션일 때만 (StoryPlayerRoute의
 *   ?tutorStudentId= 참고). 가정 세션은 생략.
 * - childId: 부모 계정에서 어느 아이 프로필로 진행한 세션인지 - 아이별 리포트 필터를 위해 첨부.
 *   선생님 세션은 childId를 생략하고 대신 tutorStudentId만 넘긴다.
 */
export function recordStoryCompletion(
  token: string,
  input: {
    storyId: string;
    durationSeconds: number | null;
    outcomes: QuestionOutcome[];
    tutorStudentId?: string;
    childId?: string;
  },
  options?: RequestOptions,
): Promise<StoryCompletionSummary> {
  return request('/v1/story-completions', { method: 'POST', body: JSON.stringify(input) }, token, options);
}

export function listStoryCompletions(
  token: string,
  filters?: { childId?: string | null },
  options?: RequestOptions,
): Promise<StoryCompletionSummary[]> {
  const query = filters?.childId ? `?childId=${encodeURIComponent(filters.childId)}` : '';
  return request(`/v1/story-completions${query}`, { method: 'GET' }, token, options);
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
  filters?: { childId?: string | null },
  options?: RequestOptions,
): Promise<StoryCompletionDetail[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (filters?.childId) params.set('childId', filters.childId);
  return request(`/v1/story-completions/recent?${params.toString()}`, { method: 'GET' }, token, options);
}
