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
  /** null이면 단발성 수업. 정기 수업 생성 시 같은 제출에서 만든 형제 lesson들이 이 값을 공유한다. */
  seriesId: string | null;
};

export type CreateLessonInput = {
  name: string;
  goal?: string | null;
  scheduledAt?: string | null;
  studentIds?: string[];
  storyIds?: string[];
  /** 정기 수업 생성 시 호출부가 crypto.randomUUID()로 한 번 만들어 N번의 create 호출 전체에
   * 같은 값을 실어 보낸다 - 나중에 "향후 모든 수업 수정"으로 형제들을 함께 찾기 위함. */
  seriesId?: string;
};

export type UpdateLessonInput = Partial<CreateLessonInput> & {
  /** true면 같은 시리즈에서 아직 SCHEDULED이고 이 수업과 같거나 이후 시각인 형제들에도 이
   * 요청을 함께 적용한다(scheduledAt은 절대값이 아니라 이 수업의 이동량만큼 각자 이동). */
  applyToFutureInSeries?: boolean;
};

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
