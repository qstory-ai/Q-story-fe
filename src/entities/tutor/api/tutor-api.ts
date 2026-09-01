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
  /**
   * 손으로 옮길 수 있는 짧은 코드 - 링크(token)와 같은 초대를 가리키지만 시크릿은 아니라
   * 대시보드에서 다시 보여줘도 안전하다. 발급 응답과 함께만 넘어온다.
   */
  shortCode: string;
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

/** short_code 기반 미리보기 - previewTutorInvite와 응답 형태는 같고 조회 경로만 다르다. */
export function previewTutorInviteByCode(shortCode: string, options?: RequestOptions): Promise<TutorInvitePreview> {
  return request(`/v1/tutor-invites/by-code/${encodeURIComponent(shortCode)}`, { method: 'GET' }, null, options);
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

/** short_code 기반 수락 - 후속 흐름은 acceptTutorInvite와 동일. 조회 경로만 다르다. */
export function acceptTutorInviteByCode(
  shortCode: string,
  input: { token?: string | null; loginId?: string; email?: string; password?: string; displayName?: string },
  options?: RequestOptions,
): Promise<AuthResponse> {
  const { token, ...body } = input;
  return request(
    `/v1/tutor-invites/by-code/${encodeURIComponent(shortCode)}/accept`,
    { method: 'POST', body: JSON.stringify(body) },
    token ?? null,
    options,
  );
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

/**
 * 방문 선생님이 특정 학생의 다음 수업에 쓸 이야기 리스트("수업에 사용하기"로 담긴 것들).
 * BE의 tutor_lesson_plan 테이블 한 행이 여기서 TutorLessonPlan 하나로 매핑된다 - 서재의
 * "수업에 사용하기" 버튼이 create를 호출하고, 선생님 수업 상세에서 list/remove를 쓴다.
 */

export type TutorLessonPlan = {
  id: string;
  tutorStudentId: string;
  studentName: string;
  storyId: string;
  addedAt: string;
};

export function listTutorLessonPlans(token: string, options?: RequestOptions): Promise<TutorLessonPlan[]> {
  return request('/v1/tutor-lesson-plans', { method: 'GET' }, token, options);
}

export function listStudentLessonPlans(
  token: string,
  studentId: string,
  options?: RequestOptions,
): Promise<TutorLessonPlan[]> {
  return request(`/v1/tutor-students/${studentId}/lesson-plans`, { method: 'GET' }, token, options);
}

export function createTutorLessonPlan(
  token: string,
  input: { tutorStudentId: string; storyId: string },
  options?: RequestOptions,
): Promise<TutorLessonPlan> {
  return request('/v1/tutor-lesson-plans', { method: 'POST', body: JSON.stringify(input) }, token, options);
}

export function removeTutorLessonPlan(token: string, planId: string, options?: RequestOptions): Promise<void> {
  // 서버는 204를 반환한다 - requestJson()이 204를 자동으로 undefined로 처리한다.
  return request(`/v1/tutor-lesson-plans/${planId}`, { method: 'DELETE' }, token, options);
}
