import { apiBaseUrl } from '@/shared/config';
import { requestJson, type PublicRequestOptions as RequestOptions } from '@/shared/api';
import type { ClassResponse } from '@/entities/auth';

/**
 * 담임 초대 - 반마다 하나씩 있는 선생님용 초대(보호자용 반 초대와 짝). 관리자가 코드를 만들어 보내면 선생님이
 * 링크로 가입·로그인하고 수락해 그 반 담임이 된다(기관 소속도 함께 생긴다). 새 코드를 만들면 이전 코드는 못 쓴다.
 */

export type HomeroomInvite = {
  id: string;
  token: string;
  shortCode: string;
  expiresAt: string;
};

export type HomeroomInvitePreview = {
  organizationName: string;
  className: string;
  expiresAt: string;
  currentHomeroomName: string | null;
};

export class HomeroomInviteApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

function request<T>(path: string, init: RequestInit, token: string | null, options: RequestOptions = {}): Promise<T> {
  return requestJson(HomeroomInviteApiError, path, init, { baseUrl: apiBaseUrl, ...options, token });
}

/** 관리자 - 새 담임 초대를 만든다. 이전에 쓰던 코드는 이 순간 더 이상 쓸 수 없다. */
export function createHomeroomInvite(
  token: string,
  classId: string,
  options?: RequestOptions,
): Promise<HomeroomInvite> {
  return request(`/v1/classes/${classId}/homeroom-invites`, { method: 'POST' }, token, options);
}

/** 관리자 - 지금 쓸 수 있는 담임 초대. 없으면(404) null. */
export async function fetchCurrentHomeroomInvite(
  token: string,
  classId: string,
  options?: RequestOptions,
): Promise<HomeroomInvite | null> {
  try {
    return await request<HomeroomInvite>(`/v1/classes/${classId}/homeroom-invites/current`, { method: 'GET' }, token, options);
  } catch (failure) {
    if (failure instanceof HomeroomInviteApiError && failure.status === 404) return null;
    throw failure;
  }
}

/** 누구나 - 코드로 어느 기관·반의 담임 초대인지 미리 본다. 없는 코드 404, 만료·사용된 코드 410. */
export function previewHomeroomInviteByCode(code: string, options?: RequestOptions): Promise<HomeroomInvitePreview> {
  return request(`/v1/class-homeroom-invites/by-code/${encodeURIComponent(code)}`, { method: 'GET' }, null, options);
}

/** 선생님 - 담임 초대를 수락한다. 응답은 담임이 된 반. */
export function acceptHomeroomInviteByCode(
  token: string,
  code: string,
  options?: RequestOptions,
): Promise<ClassResponse> {
  return request(
    `/v1/class-homeroom-invites/by-code/${encodeURIComponent(code)}/accept`,
    { method: 'POST' },
    token,
    options,
  );
}
