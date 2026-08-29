import { apiBaseUrl } from '@/shared/config';
import { requestJson, type PublicRequestOptions as RequestOptions } from '@/shared/api';
import type { AuthResponse } from '@/entities/auth';
import type { StoryCompletionSummary } from '@/entities/story-completion';

export type TutorStudentStatus = 'PENDING_PARENT' | 'CONFIRMED';

export type TutorStudent = {
  id: string;
  name: string;
  ageBand: string;
  classType: string | null;
  prepNote: string | null;
  status: TutorStudentStatus;
  linkedParentUserId: string | null;
  createdAt: string;
};

export type TutorSchedule = {
  id: string;
  tutorStudentId: string;
  studentName: string;
  weekday: 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';
  startTime: string;
  endTime: string;
  startDate: string;
  location: string;
  reminderEnabled: boolean;
};

export type TutorInvite = {
  token: string;
  expiresAt: string;
};

export type TutorInvitePreview = {
  studentName: string;
  ageBand: string;
  tutorDisplayName: string;
};

export type TutorReportSummary = {
  id: string;
  storyId: string;
  completedAt: string;
  durationSeconds: number | null;
  studentName: string;
  tutorDisplayName: string;
};

export class TutorApiError extends Error {
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
  token: string | null,
  options: RequestOptions = {},
): Promise<T> {
  return requestJson(TutorApiError, path, init, { baseUrl: apiBaseUrl, ...options, token });
}

export function createTutorStudent(
  token: string,
  input: { name: string; ageBand: string; classType?: string; prepNote?: string },
  options?: RequestOptions,
): Promise<TutorStudent> {
  return request('/v1/tutor-students', { method: 'POST', body: JSON.stringify(input) }, token, options);
}

export function listTutorStudents(token: string, options?: RequestOptions): Promise<TutorStudent[]> {
  return request('/v1/tutor-students', { method: 'GET' }, token, options);
}

export function createTutorSchedule(
  token: string,
  studentId: string,
  input: { weekday: string; startTime: string; endTime: string; startDate: string; location: string; reminderEnabled?: boolean },
  options?: RequestOptions,
): Promise<TutorSchedule> {
  return request(`/v1/tutor-students/${studentId}/schedule`, { method: 'POST', body: JSON.stringify(input) }, token, options);
}

export function listTutorSchedules(token: string, options?: RequestOptions): Promise<TutorSchedule[]> {
  return request('/v1/tutor-schedules', { method: 'GET' }, token, options);
}

export function createTutorInvite(
  token: string,
  studentId: string,
  input: { method: 'SMS' | 'LINK'; phoneNumber?: string },
  options?: RequestOptions,
): Promise<TutorInvite> {
  return request(`/v1/tutor-students/${studentId}/invites`, { method: 'POST', body: JSON.stringify(input) }, token, options);
}

export function previewTutorInvite(rawToken: string, options?: RequestOptions): Promise<TutorInvitePreview> {
  return request(`/v1/tutor-invites/${rawToken}`, { method: 'GET' }, null, options);
}

/**
 * token이 있으면(이미 로그인된 학부모) 그 계정에 바로 연결한다. 없으면 loginId/email/password/
 * displayName로 새 학부모 계정을 만들며 연결한다 - joinClass()와 같은 "초대 수락이 곧 회원가입"인 경우.
 */
export function acceptTutorInvite(
  rawToken: string,
  input: { token?: string | null; loginId?: string; email?: string; password?: string; displayName?: string },
  options?: RequestOptions,
): Promise<AuthResponse> {
  const { token, ...body } = input;
  return request(`/v1/tutor-invites/${rawToken}/accept`, { method: 'POST', body: JSON.stringify(body) }, token ?? null, options);
}

export function listTutorStudentCompletions(
  token: string,
  studentId: string,
  options?: RequestOptions,
): Promise<StoryCompletionSummary[]> {
  return request(`/v1/tutor-students/${studentId}/completions`, { method: 'GET' }, token, options);
}

export function listParentTutorReports(token: string, options?: RequestOptions): Promise<TutorReportSummary[]> {
  return request('/v1/parents/me/tutor-reports', { method: 'GET' }, token, options);
}
