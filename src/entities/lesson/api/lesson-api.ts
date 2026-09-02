import { apiBaseUrl } from '@/shared/config';
import { requestJson, type PublicRequestOptions as RequestOptions } from '@/shared/api';

/**
 * IA "[3] 수업"의 REST 클라이언트. Lesson은 학생/이야기/일정을 묶는 컨테이너로, 상태 전환은
 * SCHEDULED → IN_PROGRESS → COMPLETED 한 방향이다(역행 불가).
 */

export type LessonStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';

export type LessonStudentSummary = {
  id: string;
  name: string;
  ageBand: string;
  status: 'PENDING_PARENT' | 'CONFIRMED';
};

export type Lesson = {
  id: string;
  name: string;
  goal: string | null;
  scheduledAt: string | null;
  status: LessonStatus;
  startedAt: string | null;
  completedAt: string | null;
  students: LessonStudentSummary[];
  storyIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type CreateLessonInput = {
  name: string;
  goal?: string | null;
  scheduledAt?: string | null;
  studentIds?: string[];
  storyIds?: string[];
};

export type UpdateLessonInput = Partial<CreateLessonInput>;

export class LessonApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

function request<T>(path: string, init: RequestInit, token: string, options: RequestOptions = {}): Promise<T> {
  return requestJson(LessonApiError, path, init, { baseUrl: apiBaseUrl, ...options, token });
}

export function listLessons(
  token: string,
  filters?: { status?: LessonStatus },
  options?: RequestOptions,
): Promise<Lesson[]> {
  const query = filters?.status ? `?status=${encodeURIComponent(filters.status)}` : '';
  return request(`/v1/tutor-lessons${query}`, { method: 'GET' }, token, options);
}

export function getLesson(token: string, lessonId: string, options?: RequestOptions): Promise<Lesson> {
  return request(`/v1/tutor-lessons/${lessonId}`, { method: 'GET' }, token, options);
}

export function createLesson(token: string, input: CreateLessonInput, options?: RequestOptions): Promise<Lesson> {
  return request('/v1/tutor-lessons', { method: 'POST', body: JSON.stringify(input) }, token, options);
}

export function updateLesson(
  token: string,
  lessonId: string,
  input: UpdateLessonInput,
  options?: RequestOptions,
): Promise<Lesson> {
  return request(`/v1/tutor-lessons/${lessonId}`, { method: 'PATCH', body: JSON.stringify(input) }, token, options);
}

export function startLesson(token: string, lessonId: string, options?: RequestOptions): Promise<Lesson> {
  return request(`/v1/tutor-lessons/${lessonId}/start`, { method: 'POST' }, token, options);
}

export function completeLesson(token: string, lessonId: string, options?: RequestOptions): Promise<Lesson> {
  return request(`/v1/tutor-lessons/${lessonId}/complete`, { method: 'POST' }, token, options);
}

export function deleteLesson(token: string, lessonId: string, options?: RequestOptions): Promise<void> {
  // 서버는 204를 반환 - requestJson()이 undefined로 처리.
  return request(`/v1/tutor-lessons/${lessonId}`, { method: 'DELETE' }, token, options);
}
