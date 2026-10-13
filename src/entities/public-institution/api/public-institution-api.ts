import { apiBaseUrl } from '@/shared/config';
import { requestJson, type PublicRequestOptions as RequestOptions } from '@/shared/api';

/**
 * 공공데이터 유치원·어린이집 목록(BE public_institution, 083)과 그 목록을 쓰는 두 흐름:
 *  - 원장: 목록에서 골라 기관 등록(createOrganization의 publicInstitutionId), 이미 만든 기관을 목록과 연결.
 *  - 선생님: 검색으로 찾은 기관에 소속 신청 → 원장이 수락·거절.
 */

export type InstitutionKind = 'KINDERGARTEN' | 'DAYCARE';

export type PublicInstitution = {
  id: string;
  kind: InstitutionKind;
  name: string;
  address: string | null;
  sido: string | null;
  sigungu: string | null;
  establishmentType: string | null;
  /** 로그인한 원장·선생님에게만 채워진다(익명 검색은 null). */
  registered: boolean | null;
  organizationId: string | null;
};

export type PublicInstitutionSearchResult = {
  items: PublicInstitution[];
  hasMore: boolean;
  /** 출처 표기(공공누리 제1유형) - 검색 결과 아래에 그대로 보여 준다. */
  attribution: string;
};

export type OrganizationProfile = {
  id: string;
  name: string;
  publicInstitution: {
    id: string;
    kind: InstitutionKind;
    name: string;
    address: string | null;
    establishmentType: string | null;
  } | null;
};

export type JoinRequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELED';

export type TutorJoinRequest = {
  id: string;
  organizationId: string;
  organizationName: string;
  status: JoinRequestStatus;
  createdAt: string;
  decidedAt: string | null;
};

export type OrganizationJoinRequest = {
  id: string;
  tutorId: string;
  tutorDisplayName: string;
  tutorEmail: string | null;
  status: JoinRequestStatus;
  createdAt: string;
  decidedAt: string | null;
};

export class PublicInstitutionApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

function request<T>(path: string, init: RequestInit, token: string | null, options: RequestOptions = {}): Promise<T> {
  return requestJson(PublicInstitutionApiError, path, init, { baseUrl: apiBaseUrl, ...options, token });
}

export const INSTITUTION_KIND_LABEL: Record<InstitutionKind, string> = {
  KINDERGARTEN: '유치원',
  DAYCARE: '어린이집',
};

/** 서버와 같은 규칙 - 공백을 뺀 검색어가 두 글자 이상이어야 부른다. */
export function isSearchableInstitutionQuery(query: string): boolean {
  return query.replace(/\s+/g, '').length >= 2;
}

/** 검색어 쿼리 문자열 - 빈 값은 넣지 않는다. */
export function institutionSearchQuery(query: string, kind?: InstitutionKind | null, limit?: number): string {
  const params = new URLSearchParams({ q: query.trim() });
  if (kind) params.set('kind', kind);
  if (limit) params.set('limit', String(limit));
  return `?${params.toString()}`;
}

export function searchPublicInstitutions(
  token: string | null,
  query: string,
  kind?: InstitutionKind | null,
  options?: RequestOptions,
): Promise<PublicInstitutionSearchResult> {
  const search = institutionSearchQuery(query, kind, 10);
  return request(`/v1/public-institutions${search}`, { method: 'GET' }, token, options);
}

/* -------------------------------------------------------------- director-side */

export function fetchOrganizationProfile(
  token: string,
  organizationId: string,
  options?: RequestOptions,
): Promise<OrganizationProfile> {
  return request(`/v1/organizations/${organizationId}/profile`, { method: 'GET' }, token, options);
}

export function linkOrganizationPublicInstitution(
  token: string,
  organizationId: string,
  publicInstitutionId: string,
  options?: RequestOptions,
): Promise<OrganizationProfile> {
  return request(
    `/v1/organizations/${organizationId}/public-institution`,
    { method: 'PUT', body: JSON.stringify({ publicInstitutionId }) },
    token,
    options,
  );
}

export function listOrganizationJoinRequests(
  token: string,
  organizationId: string,
  options?: RequestOptions,
): Promise<OrganizationJoinRequest[]> {
  return request(`/v1/organizations/${organizationId}/join-requests`, { method: 'GET' }, token, options);
}

export function acceptOrganizationJoinRequest(
  token: string,
  organizationId: string,
  requestId: string,
  options?: RequestOptions,
): Promise<OrganizationJoinRequest> {
  return request(
    `/v1/organizations/${organizationId}/join-requests/${requestId}/accept`,
    { method: 'POST' },
    token,
    options,
  );
}

export function rejectOrganizationJoinRequest(
  token: string,
  organizationId: string,
  requestId: string,
  options?: RequestOptions,
): Promise<OrganizationJoinRequest> {
  return request(
    `/v1/organizations/${organizationId}/join-requests/${requestId}/reject`,
    { method: 'POST' },
    token,
    options,
  );
}

/* -------------------------------------------------------------- tutor-side */

export function createJoinRequest(
  token: string,
  organizationId: string,
  options?: RequestOptions,
): Promise<TutorJoinRequest> {
  return request(
    '/v1/organization-join-requests',
    { method: 'POST', body: JSON.stringify({ organizationId }) },
    token,
    options,
  );
}

export function listMyJoinRequests(token: string, options?: RequestOptions): Promise<TutorJoinRequest[]> {
  return request('/v1/tutors/me/organization-join-requests', { method: 'GET' }, token, options);
}

export function cancelJoinRequest(token: string, requestId: string, options?: RequestOptions): Promise<TutorJoinRequest> {
  return request(`/v1/organization-join-requests/${requestId}/cancel`, { method: 'POST' }, token, options);
}
