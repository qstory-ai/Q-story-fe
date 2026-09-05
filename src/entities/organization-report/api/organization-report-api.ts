import { apiBaseUrl } from '@/shared/config';
import { requestJson, type RequestOptions } from '@/shared/api';

export type OrganizationReport = {
  generatedAt: string;
  completionCount: number;
  questionCount: number;
  classes: Array<{
    classId: string;
    className: string;
    parentCount: number;
    completionCount: number;
    questionCount: number;
    lastActivityAt: string | null;
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
