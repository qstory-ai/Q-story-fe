import { apiBaseUrl } from '@/shared/config';
import { requestJson, type PublicRequestOptions as RequestOptions } from '@/shared/api';

/**
 * BE의 /v1/parents/me/notification-settings 두 엔드포인트를 감싼다. 지금은 마케팅 알림 토글
 * 하나뿐이지만, 앞으로 (주간 리포트 알림, 아이 학습 알림 등) 항목이 늘어도 이 파일 하나에만
 * 필드를 추가하면 되도록 shape을 열어 뒀다.
 */

export type NotificationSettings = {
  marketingEnabled: boolean;
};

export type UpdateNotificationSettingsInput = Partial<NotificationSettings>;

export class NotificationSettingsApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

function request<T>(
  path: string,
  init: RequestInit,
  token: string,
  options: RequestOptions = {},
): Promise<T> {
  return requestJson(NotificationSettingsApiError, path, init, { baseUrl: apiBaseUrl, ...options, token });
}

export function getNotificationSettings(token: string, options?: RequestOptions): Promise<NotificationSettings> {
  return request('/v1/parents/me/notification-settings', { method: 'GET' }, token, options);
}

export function updateNotificationSettings(
  token: string,
  input: UpdateNotificationSettingsInput,
  options?: RequestOptions,
): Promise<NotificationSettings> {
  return request(
    '/v1/parents/me/notification-settings',
    { method: 'PATCH', body: JSON.stringify(input) },
    token,
    options,
  );
}
