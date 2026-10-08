import { apiBaseUrl } from '@/shared/config';
import { requestJson } from '@/shared/api';

/** BE의 /v1/me/push-tokens - 이 기기의 FCM 토큰을 로그인한 계정에 묶고(등록) 푼다(해제). 둘 다 204. */

export type PushPlatform = 'ANDROID' | 'IOS' | 'WEB';

export class PushTokenApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

export function registerPushToken(authToken: string, token: string, platform: PushPlatform): Promise<void> {
  return requestJson<void, PushTokenApiError>(
    PushTokenApiError,
    '/v1/me/push-tokens',
    { method: 'POST', body: JSON.stringify({ token, platform }) },
    { baseUrl: apiBaseUrl, token: authToken, parseResponse: false },
  );
}

export function removePushToken(authToken: string, token: string): Promise<void> {
  return requestJson<void, PushTokenApiError>(
    PushTokenApiError,
    '/v1/me/push-tokens/remove',
    // 로그아웃 직후 화면이 바뀌어도 요청이 끝까지 가게 keepalive.
    { method: 'POST', body: JSON.stringify({ token }), keepalive: true },
    { baseUrl: apiBaseUrl, token: authToken, parseResponse: false },
  );
}
