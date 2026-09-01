import { apiBaseUrl } from '@/shared/config';
import { requestJson, type PublicRequestOptions as RequestOptions } from '@/shared/api';

/**
 * IA "기관 관리자 > 선생님 관리" + "선생님 마이페이지 > 소속 기관"이 공유하는 REST 클라이언트.
 * 관리자용(POST/DELETE/list) 엔드포인트와 선생님용(preview/accept/my orgs) 엔드포인트를 한 파일에
 * 모은 이유는 그 둘이 실질적으로 같은 리소스(OrganizationTutor)를 서로 다른 관점에서 다루기 때문.
 */

export type OrganizationTutorLink = {
  id: string;
  tutorId: string;
  tutorDisplayName: string;
  tutorEmail: string | null;
  joinedAt: string;
};

export type TutorOrganizationLink = {
  id: string;
  organizationId: string;
  organizationName: string;
  joinedAt: string;
};

export type OrganizationTutorInvite = {
  id: string;
  token: string;
  shortCode: string;
  expiresAt: string;
};

export type OrganizationTutorInviteSummary = {
  id: string;
  shortCode: string;
  expiresAt: string;
  usedAt: string | null;
  usedByTutorId: string | null;
  usedByTutorDisplayName: string | null;
  createdAt: string;
};

export type OrganizationTutorInvitePreview = {
  organizationName: string;
};

export class OrganizationTutorApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

function request<T>(path: string, init: RequestInit, token: string | null, options: RequestOptions = {}): Promise<T> {
  return requestJson(OrganizationTutorApiError, path, init, { baseUrl: apiBaseUrl, ...options, token });
}

/* -------------------------------------------------------------- director-side */

export function listOrganizationTutors(
  token: string,
  organizationId: string,
  options?: RequestOptions,
): Promise<OrganizationTutorLink[]> {
  return request(`/v1/organizations/${organizationId}/tutors`, { method: 'GET' }, token, options);
}

export function listOrganizationTutorInvites(
  token: string,
  organizationId: string,
  options?: RequestOptions,
): Promise<OrganizationTutorInviteSummary[]> {
  return request(`/v1/organizations/${organizationId}/tutor-invites`, { method: 'GET' }, token, options);
}

export function createOrganizationTutorInvite(
  token: string,
  organizationId: string,
  options?: RequestOptions,
): Promise<OrganizationTutorInvite> {
  return request(`/v1/organizations/${organizationId}/tutor-invites`, { method: 'POST' }, token, options);
}

export function unlinkOrganizationTutor(
  token: string,
  organizationId: string,
  tutorId: string,
  options?: RequestOptions,
): Promise<void> {
  // 서버는 204를 반환 - requestJson()이 자동으로 undefined로 처리한다.
  return request(`/v1/organizations/${organizationId}/tutors/${tutorId}`, { method: 'DELETE' }, token, options);
}

/* -------------------------------------------------------------- tutor-side */

export function previewOrganizationTutorInvite(
  rawToken: string,
  options?: RequestOptions,
): Promise<OrganizationTutorInvitePreview> {
  return request(`/v1/organization-tutor-invites/${rawToken}`, { method: 'GET' }, null, options);
}

export function previewOrganizationTutorInviteByCode(
  shortCode: string,
  options?: RequestOptions,
): Promise<OrganizationTutorInvitePreview> {
  return request(
    `/v1/organization-tutor-invites/by-code/${encodeURIComponent(shortCode)}`,
    { method: 'GET' },
    null,
    options,
  );
}

export function acceptOrganizationTutorInvite(
  token: string,
  rawToken: string,
  options?: RequestOptions,
): Promise<OrganizationTutorLink> {
  return request(`/v1/organization-tutor-invites/${rawToken}/accept`, { method: 'POST' }, token, options);
}

export function acceptOrganizationTutorInviteByCode(
  token: string,
  shortCode: string,
  options?: RequestOptions,
): Promise<OrganizationTutorLink> {
  return request(
    `/v1/organization-tutor-invites/by-code/${encodeURIComponent(shortCode)}/accept`,
    { method: 'POST' },
    token,
    options,
  );
}

export function listMyOrganizations(token: string, options?: RequestOptions): Promise<TutorOrganizationLink[]> {
  return request('/v1/tutors/me/organizations', { method: 'GET' }, token, options);
}
