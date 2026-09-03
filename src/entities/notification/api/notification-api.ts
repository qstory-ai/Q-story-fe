import { apiBaseUrl } from '@/shared/config';
import { requestJson, type PublicRequestOptions as RequestOptions } from '@/shared/api';

/**
 * BE의 /v1/notifications 계열 엔드포인트를 감싼다. 현재는 목록 조회 + 단건 읽음 + 전체 읽음
 * 세 가지 액션. push/이메일은 아직 범위 밖.
 */

export type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationListResponse = {
  notifications: Notification[];
  unreadCount: number;
};

export class NotificationApiError extends Error {
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
  return requestJson(NotificationApiError, path, init, { baseUrl: apiBaseUrl, ...options, token });
}

export function listNotifications(token: string, options?: RequestOptions): Promise<NotificationListResponse> {
  return request('/v1/notifications', { method: 'GET' }, token, options);
}

export function markNotificationRead(
  token: string,
  id: string,
  options?: RequestOptions,
): Promise<Notification> {
  return request(`/v1/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' }, token, options);
}

export function markAllNotificationsRead(
  token: string,
  options?: RequestOptions,
): Promise<void> {
  return requestJson<void, NotificationApiError>(
    NotificationApiError,
    '/v1/notifications/read-all',
    { method: 'POST' },
    { baseUrl: apiBaseUrl, ...options, token, parseResponse: false },
  );
}

export function deleteNotification(
  token: string,
  id: string,
  options?: RequestOptions,
): Promise<void> {
  return requestJson<void, NotificationApiError>(
    NotificationApiError,
    `/v1/notifications/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    { baseUrl: apiBaseUrl, ...options, token, parseResponse: false },
  );
}
