import { readEnv } from '@/shared/config';

const apiBaseUrl = readEnv('VITE_QSTORY_API_URL');

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

export async function submitLaunchNotification(
  input: LaunchNotificationSubmission,
  options?: { baseUrl?: string; fetchImpl?: typeof fetch },
): Promise<void> {
  const { baseUrl = apiBaseUrl, fetchImpl = fetch } = options ?? {};
  if (!baseUrl) {
    throw new LaunchNotificationApiError('VITE_QSTORY_API_URL is not configured.');
  }
  const response = await fetchImpl.call(globalThis, `${baseUrl}/v1/launch-notifications`, {
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
    throw new LaunchNotificationApiError(
      safeDetail ?? `요청을 처리하지 못했어요. (HTTP ${response.status})`,
      code,
      response.status,
    );
  }
}
