import { apiBaseUrl } from '@/shared/config';
import { requestJson, type PublicRequestOptions as RequestOptions } from '@/shared/api';
import type { ClassMembershipEndReason, ClassResponse } from '@/entities/auth';

/**
 * 반 수명주기(관리자) - 이름 바꾸기, 학생 옮기기, 학기 마무리, 지난 반 보관·다시 열기, 학생의 반 이력, 선생님의 지난 반.
 * 옮기고 수료해도 학생 기록은 그대로 남고, 지난 반의 리포트도 계속 열린다.
 */

/** 학생을 옮기지 못한 이유. */
export type MoveSkipReason = 'NOT_IN_CLASS' | 'GRADUATED' | 'SAME_CLASS' | 'ALREADY_IN_TARGET' | 'ALREADY_TUTOR_STUDENT';

export type SkippedStudent = { studentId: string; reason: MoveSkipReason | string };

export type MoveStudentsResult = { moved: string[]; skipped: SkippedStudent[] };

export type TermTransitionAction = 'MOVE' | 'KEEP' | 'GRADUATE';

export type TermTransitionDecision = { studentId: string; action: TermTransitionAction; targetClassId?: string };

export type TermTransitionRequest = { decisions: TermTransitionDecision[]; archiveClass: boolean };

export type TermTransitionResult = {
  moved: string[];
  kept: string[];
  graduated: string[];
  archived: boolean;
  skipped: SkippedStudent[];
};

/** 학생의 반 이력 한 구간(오래된 순). endedAt이 null이면 지금 반. className은 지금 반 이름이다. */
export type ClassHistoryEntry = {
  classId: string;
  className: string;
  classArchived: boolean;
  startedAt: string;
  endedAt: string | null;
  /** 구간이 시작된 이유 - JOINED(반 코드로 들어옴) | MOVED | KEPT. */
  reason: 'JOINED' | 'MOVED' | 'KEPT' | string;
  endReason: ClassMembershipEndReason | string | null;
};

/** 선생님이 예전에 맡았던 반. ledUntil이 null이면 보관된 반을 아직 맡고 있다. */
export type PastTutorClass = {
  id: string;
  organizationId: string | null;
  organizationName: string | null;
  name: string;
  archivedAt: string | null;
  ledFrom: string | null;
  ledUntil: string | null;
};

export class ClassLifecycleApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

function request<T>(path: string, init: RequestInit, token: string, options: RequestOptions = {}): Promise<T> {
  return requestJson(ClassLifecycleApiError, path, init, { baseUrl: apiBaseUrl, ...options, token });
}

/** 반 이름 바꾸기 - 지난 리포트는 그때 이름으로 남는다. 빈 이름·255자 초과는 400. */
export function renameClass(token: string, classId: string, name: string, options?: RequestOptions): Promise<ClassResponse> {
  return request(`/v1/classes/${classId}`, { method: 'PATCH', body: JSON.stringify({ name }) }, token, options);
}

/** 지난 반으로 보관 - 지금 학생이 남아 있으면 409 CLASS_HAS_ACTIVE_STUDENTS(학기 마무리를 먼저). */
export function archiveClass(token: string, classId: string, options?: RequestOptions): Promise<ClassResponse> {
  return request(`/v1/classes/${classId}/archive`, { method: 'POST' }, token, options);
}

/** 지난 반을 다시 연다 - 반 코드가 다시 살아난다. */
export function unarchiveClass(token: string, classId: string, options?: RequestOptions): Promise<ClassResponse> {
  return request(`/v1/classes/${classId}/unarchive`, { method: 'POST' }, token, options);
}

/** 학생을 같은 기관의 다른 반으로 옮긴다. 학생마다 옮기지 못한 이유는 skipped로 온다. */
export function moveClassStudents(
  token: string,
  classId: string,
  input: { studentIds: string[]; targetClassId: string },
  options?: RequestOptions,
): Promise<MoveStudentsResult> {
  return request(`/v1/classes/${classId}/students/move`, { method: 'POST', body: JSON.stringify(input) }, token, options);
}

/** 학기 마무리 - 지금 학생 모두에게 옮김·그대로·수료를 한 번에 적용한다. */
export function runTermTransition(
  token: string,
  classId: string,
  input: TermTransitionRequest,
  options?: RequestOptions,
): Promise<TermTransitionResult> {
  return request(`/v1/classes/${classId}/term-transition`, { method: 'POST', body: JSON.stringify(input) }, token, options);
}

/** 학생의 반 이력(오래된 순) - 관리자, 지금 담임, 지난 담임. */
export function listStudentClassHistory(token: string, studentId: string, options?: RequestOptions): Promise<ClassHistoryEntry[]> {
  return request(`/v1/tutor-students/${studentId}/class-history`, { method: 'GET' }, token, options);
}

/** 선생님이 예전에 맡았던 반(담임이 바뀌었거나 보관된 반). */
export function listPastTutorClasses(token: string, options?: RequestOptions): Promise<PastTutorClass[]> {
  return request('/v1/tutor-classes/past', { method: 'GET' }, token, options);
}
