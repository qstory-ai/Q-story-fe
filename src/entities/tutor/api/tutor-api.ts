import { apiBaseUrl } from '@/shared/config';
import { requestJson, type PublicRequestOptions as RequestOptions } from '@/shared/api';
import type { StoryCompletionSummary } from '@/entities/story-completion';
import { teacherTitle } from '@/shared/lib';

export type TutorStudentStatus = 'PENDING_PARENT' | 'CONFIRMED';

/**
 * INDIVIDUAL = 1:1 개인 레슨, CLASS = 반 수업(classGroupId가 채워진다). 화면은 이제 반 수업만 만든다
 * (1:1 과외도 아이 한 명짜리 반) - 응답 모양을 그대로 받으려고 타입만 남긴다.
 */
export type TutorLessonType = 'INDIVIDUAL' | 'CLASS';

/** 선생님이 볼 수 있는 반 - 내가 만든 반(tutorId = 나) + 소속 기관의 반. 기관 반이면 organizationId. */
export type TutorClass = {
  id: string;
  organizationId: string | null;
  tutorId: string | null;
  name: string;
  joinCode: string;
  createdAt: string;
};

export type TutorStudent = {
  id: string;
  name: string;
  ageBand: string;
  classType: string | null;
  prepNote: string | null;
  status: TutorStudentStatus;
  lessonType: TutorLessonType;
  classGroupId: string | null;
  classGroupName: string | null;
  /** ~년생. ageBand("N세")는 서버가 이 값으로 매번 계산한다. 예전 학생은 null. */
  birthYear: number | null;
  linkedParentUserId: string | null;
  /** 부모가 초대를 수락하며 연결(또는 생성)한 부모 쪽 아이 프로필 id. 수락 전이면 null. */
  childId: string | null;
  createdAt: string;
};

export type TutorReportSummary = {
  id: string;
  storyId: string;
  completedAt: string;
  durationSeconds: number | null;
  /** 참여한 학생 중 이 부모의 아이 이름(둘 이상이면 쉼표로). */
  studentName: string;
  tutorDisplayName: string;
  /** CLASS면 반이 함께 읽은 기록(반 수업 리포트), TUTOR면 선생님과 우리 아이의 개별 수업. */
  sessionKind: 'CLASS' | 'TUTOR';
  className: string | null;
  organizationName: string | null;
};

/** 수업 리포트 목록 한 줄의 출처 - "햇님반 수업 · 김선생 선생님" / "김선생 선생님 · 민서". */
export function tutorReportSource(report: TutorReportSummary): string {
  if (report.sessionKind === 'CLASS') {
    const where = [report.organizationName, report.className].filter(Boolean).join(' ');
    return `${where ? `${where} ` : ''}반 수업 · ${teacherTitle(report.tutorDisplayName)}`;
  }
  return `${teacherTitle(report.tutorDisplayName)} · ${report.studentName}`;
}

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

export function listTutorStudents(token: string, options?: RequestOptions): Promise<TutorStudent[]> {
  return request('/v1/tutor-students', { method: 'GET' }, token, options);
}

export function getTutorStudent(token: string, studentId: string, options?: RequestOptions): Promise<TutorStudent> {
  return request(`/v1/tutor-students/${studentId}`, { method: 'GET' }, token, options);
}

export function updateTutorStudent(
  token: string,
  studentId: string,
  input: {
    classType?: string | null;
    prepNote?: string | null;
    birthYear?: number;
  },
  options?: RequestOptions,
): Promise<TutorStudent> {
  return request(`/v1/tutor-students/${studentId}`, { method: 'PATCH', body: JSON.stringify(input) }, token, options);
}

export function deleteTutorStudent(
  token: string,
  studentId: string,
  options?: RequestOptions,
): Promise<void> {
  // 204 응답 - requestJson()이 undefined로 처리.
  return request(`/v1/tutor-students/${studentId}`, { method: 'DELETE' }, token, options);
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

/* -------------------------------------------------------------- classes */

/** 내가 만든 반 + 소속 기관의 반. 수업 생성·이야기 시작의 반 선택지가 된다. */
export function listTutorClasses(token: string, options?: RequestOptions): Promise<TutorClass[]> {
  return request('/v1/tutor-classes', { method: 'GET' }, token, options);
}

/** organizationId를 주면 그 기관(소속돼 있어야 함) 안의 반으로 만들어져 기관 관리자의 반 목록에도 보인다. */
export function createTutorClass(
  token: string,
  input: { name: string; organizationId?: string },
  options?: RequestOptions,
): Promise<TutorClass> {
  return request('/v1/tutor-classes', { method: 'POST', body: JSON.stringify(input) }, token, options);
}
