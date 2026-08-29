import { apiBaseUrl } from '@/shared/config';
import { requestJson, type PublicRequestOptions } from '@/shared/api';

export type CompletionSurveySubmission = {
  storyId: string;
  childAgeBand: string;
  childEngagement: number;
  inputUnderstanding: string;
  helpNeeded: string;
  childReactions: string[];
  disruptions: string[];
  reportHelpfulness: number;
  bestAspect: string;
  /** 선택 입력. */
  topPriority?: string;
  retryInterest: string;
  /** 선택 입력. */
  oneLineReview?: string;
  reviewUsageConsent: string;
  wantsNextStories: string;
  /** 선택 입력 - 이메일 또는 휴대전화 번호, 자유 텍스트. */
  contact?: string;
  contactConsent: string;
};

/** auth-api.ts의 AuthApiError와 동일한 이유로, 백엔드 safeDetail을 폼 에러 메시지로 그대로 노출한다. */
export class CompletionSurveyApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

export function submitCompletionSurvey(
  input: CompletionSurveySubmission,
  options?: PublicRequestOptions,
): Promise<void> {
  return requestJson(
    CompletionSurveyApiError,
    '/v1/completion-surveys',
    { method: 'POST', body: JSON.stringify(input) },
    { baseUrl: apiBaseUrl, ...options, parseResponse: false },
  );
}
