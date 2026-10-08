import { apiBaseUrl } from '@/shared/config';
import { requestJson, type RequestOptions } from '@/shared/api';

export type OrganizationReport = {
  generatedAt: string;
  completionCount: number;
  questionCount: number;
  classes: Array<{
    classId: string;
    className: string;
    studentCount: number;
    completionCount: number;
    questionCount: number;
    lastActivityAt: string | null;
    /** 지난 반 - 보관된 반도 지난 기록이 있으면 집계에 남는다. 옛 응답에는 없을 수 있다. */
    archived?: boolean;
  }>;
  topStories: Array<{ storyId: string; completionCount: number }>;
};

export class OrganizationReportApiError extends Error {
  constructor(message: string, public readonly code?: string, public readonly status?: number) {
    super(message);
  }
}

export function getOrganizationReport(
  token: string,
  organizationId: string,
  options: RequestOptions = {},
): Promise<OrganizationReport> {
  return requestJson(
    OrganizationReportApiError,
    `/v1/organizations/${organizationId}/reports`,
    { method: 'GET' },
    { baseUrl: apiBaseUrl, ...options, token },
  );
}
