import { apiBaseUrl } from '@/shared/config';
import { requestJson, type PublicRequestOptions as RequestOptions } from '@/shared/api';

/**
 * IA "기관 관리자 > 이용 현황 관리"의 요약 응답. DIRECTOR 대시보드가 필요로 하는 최소 지표
 * 몇 개(선생님/반/부모/반 계정/완주 수)와 최근 활동 리스트를 담는다.
 */

export type OrganizationUsageRecentActivity = {
  completionId: string;
  storyId: string;
  actorDisplayName: string;
  completedAt: string;
};

export type OrganizationUsage = {
  tutorCount: number;
  classCount: number;
  parentCount: number;
  classAccountCount: number;
  completionCount: number;
  recentActivity: OrganizationUsageRecentActivity[];
};

export class OrganizationUsageApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

function request<T>(path: string, init: RequestInit, token: string, options: RequestOptions = {}): Promise<T> {
  return requestJson(OrganizationUsageApiError, path, init, { baseUrl: apiBaseUrl, ...options, token });
}

export function getOrganizationUsage(
  token: string,
  organizationId: string,
  options?: RequestOptions,
): Promise<OrganizationUsage> {
  return request(`/v1/organizations/${organizationId}/usage`, { method: 'GET' }, token, options);
}
