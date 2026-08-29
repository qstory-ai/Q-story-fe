import { apiBaseUrl } from '@/shared/config';
import { requestJson, type PublicRequestOptions } from '@/shared/api';

export type SubmitFeedbackInput = { message: string };

/** auth-api.ts의 AuthApiError와 동일한 이유로, 백엔드 safeDetail을 폼 에러 메시지로 그대로 노출한다. */
export class FeedbackApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

export function submitFeedback(
  token: string,
  input: SubmitFeedbackInput,
  options?: PublicRequestOptions,
): Promise<void> {
  return requestJson(
    FeedbackApiError,
    '/v1/feedback',
    { method: 'POST', body: JSON.stringify(input) },
    { baseUrl: apiBaseUrl, ...options, token, parseResponse: false },
  );
}
