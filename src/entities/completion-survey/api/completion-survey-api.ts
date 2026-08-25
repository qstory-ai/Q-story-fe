import { readEnv } from '@/shared/config';

const apiBaseUrl = readEnv('VITE_QSTORY_API_URL');

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

export async function submitCompletionSurvey(
  input: CompletionSurveySubmission,
  options?: { baseUrl?: string; fetchImpl?: typeof fetch },
): Promise<void> {
  const { baseUrl = apiBaseUrl, fetchImpl = fetch } = options ?? {};
  if (!baseUrl) {
    throw new CompletionSurveyApiError('VITE_QSTORY_API_URL is not configured.');
  }
  const response = await fetchImpl.call(globalThis, `${baseUrl}/v1/completion-surveys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
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
    throw new CompletionSurveyApiError(
      safeDetail ?? `요청을 처리하지 못했어요. (HTTP ${response.status})`,
      code,
      response.status,
    );
  }
}
