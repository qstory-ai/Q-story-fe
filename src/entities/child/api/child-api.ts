import { apiBaseUrl } from '@/shared/config';
import { requestJson, type PublicRequestOptions as RequestOptions } from '@/shared/api';

/**
 * IA에서 정의한 학부모 홈의 "아이 선택" 축을 실제로 백엔드에 저장하기 위한 REST API - 예전에는
 * app_user.child_name 단일 문자열이 이 자리를 대신했지만, 한 부모가 여러 아이를 관리한다는
 * 요구를 반영해 별도 리소스로 승격했다. 서버 스키마는 be/parent/child 패키지 참조.
 */

export type Child = {
  id: string;
  name: string;
  ageBand: AgeBand;
  avatarKey: string;
  gender: 'FEMALE' | 'MALE' | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * IA에서 열거한 대상 연령대(6~9세 근처). 백엔드는 문자열이면 뭐든 받지만, UI에서 만들 수 있는
 * 값은 이 다섯 개로 좁혀 오탈자/변형을 원천 차단한다 - listStories() 필터도 같은 상수 표를 쓴다.
 */
export const AGE_BANDS = ['4-5', '6-7', '8-9', '10-11', '12+'] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export type CreateChildInput = {
  name: string;
  ageBand: AgeBand;
  avatarKey: string;
  gender?: 'FEMALE' | 'MALE' | null;
};

export type UpdateChildInput = Partial<CreateChildInput>;

export class ChildApiError extends Error {
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
  token: string,
  options: RequestOptions = {},
): Promise<T> {
  return requestJson(ChildApiError, path, init, { baseUrl: apiBaseUrl, ...options, token });
}

export function listChildren(token: string, options?: RequestOptions): Promise<Child[]> {
  return request('/v1/parents/me/children', { method: 'GET' }, token, options);
}

export function createChild(token: string, input: CreateChildInput, options?: RequestOptions): Promise<Child> {
  return request('/v1/parents/me/children', { method: 'POST', body: JSON.stringify(input) }, token, options);
}

export function updateChild(
  token: string,
  childId: string,
  input: UpdateChildInput,
  options?: RequestOptions,
): Promise<Child> {
  return request(`/v1/parents/me/children/${childId}`, { method: 'PATCH', body: JSON.stringify(input) }, token, options);
}

export function deleteChild(token: string, childId: string, options?: RequestOptions): Promise<void> {
  // 서버는 204 No Content로 응답한다 - requestJson()이 204를 자동으로 undefined로 처리한다.
  return request(`/v1/parents/me/children/${childId}`, { method: 'DELETE' }, token, options);
}
