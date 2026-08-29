import { apiBaseUrl } from '@/shared/config';
import { requestJson, type PublicRequestOptions } from '@/shared/api';

export type ChildGender = 'BOY' | 'GIRL' | 'UNSPECIFIED';

export type LaunchNotificationSubmission = {
  parentName: string;
  /** 연락 의사와 무관하게 선택 입력이다. */
  email?: string;
  phone: string;
  childGender: ChildGender;
  /** "5세", "3개월"처럼 자유 텍스트다 - 돌 전 아이는 나이를 개월 수로 말하는 경우가 많아 숫자로 강제하지 않는다. */
  childAge: string;
  discoverySource: string;
  /** "연락 받고 싶어요"=true, "괜찮아요"=false - 두 경우 모두 나머지 정보는 동일하게 받는다. */
  wantsContact: boolean;
};

/** auth-api.ts의 AuthApiError와 동일한 이유로, 백엔드 safeDetail을 폼 에러 메시지로 그대로 노출한다. */
export class LaunchNotificationApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

export function submitLaunchNotification(
  input: LaunchNotificationSubmission,
  options?: PublicRequestOptions,
): Promise<void> {
  return requestJson(
    LaunchNotificationApiError,
    '/v1/launch-notifications',
    { method: 'POST', body: JSON.stringify(input) },
    { baseUrl: apiBaseUrl, ...options, parseResponse: false },
  );
}
