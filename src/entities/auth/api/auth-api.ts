import { readEnv } from '@/shared/config';

const apiBaseUrl = readEnv('VITE_QSTORY_API_URL');

export type Role = 'DIRECTOR' | 'CLASS_ACCOUNT' | 'PARENT' | 'STAFF';

export type UserSummary = {
  id: string;
  role: Role;
  loginId: string;
  displayName: string;
  organizationId: string | null;
  classId: string | null;
};

export type AuthResponse = {
  token: string;
  user: UserSummary;
};

export type OrganizationResponse = {
  id: string;
  name: string;
  subscriptionStatus: 'NONE' | 'TRIALING' | 'ACTIVE' | 'EXPIRED';
  createdAt: string;
};

export type EntitlementResponse = {
  subscriptionStatus: OrganizationResponse['subscriptionStatus'];
  grantsAccess: boolean;
};

export type ClassResponse = {
  id: string;
  organizationId: string;
  name: string;
  joinCode: string;
  createdAt: string;
};

export type ClassInviteResponse = {
  token: string;
  expiresAt: string;
};

type RequestOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  token?: string | null;
};

/**
 * 백엔드의 실패 envelope은 {ok:false, failure:{code, stage, retryable, safeDetail}} 형태이다 -
 * safeDetail은 사용자에게 그대로 보여주기 위해 작성되므로, 폼 에러 메시지는 일반적인
 * "HTTP 4xx" 문자열 대신 이를 있는 그대로 노출한다 (story-registry.ts의 fetch와는 다른데,
 * 그쪽의 실패는 사용자에게 직접 보여지는 일이 없다).
 */
export class AuthApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  init: RequestInit,
  { baseUrl = apiBaseUrl, fetchImpl = fetch, token }: RequestOptions = {},
): Promise<T> {
  if (!baseUrl) {
    throw new AuthApiError('VITE_QSTORY_API_URL is not configured.');
  }
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetchImpl.call(globalThis, `${baseUrl}${path}`, { ...init, headers });
  if (!response.ok) {
    let code: string | undefined;
    let safeDetail: string | undefined;
    try {
      const body = (await response.json()) as { failure?: { code?: string; safeDetail?: string } };
      code = body.failure?.code;
      safeDetail = body.failure?.safeDetail;
    } catch {
      // 실패 응답 본문을 읽지 못하면 아래 기본 메시지로 대체한다.
    }
    throw new AuthApiError(safeDetail ?? `요청을 처리하지 못했어요. (HTTP ${response.status})`, code, response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function signupOrganizationOwner(
  input: { email: string; password: string; displayName: string },
  options?: RequestOptions,
): Promise<AuthResponse> {
  return request('/v1/auth/signup/organization', { method: 'POST', body: JSON.stringify(input) }, options);
}

export function login(
  input: { loginId: string; password: string },
  options?: RequestOptions,
): Promise<AuthResponse> {
  return request('/v1/auth/login', { method: 'POST', body: JSON.stringify(input) }, options);
}

/** loginId가 계정과 일치하는지 여부와 무관하게 항상 resolve된다 - 백엔드가 어느 쪽이든 동일하게 응답하기 때문이다. */
export function requestPasswordReset(
  input: { loginId: string },
  options?: RequestOptions,
): Promise<void> {
  return request('/v1/auth/password-reset/request', { method: 'POST', body: JSON.stringify(input) }, options);
}

export function confirmPasswordReset(
  input: { token: string; newPassword: string },
  options?: RequestOptions,
): Promise<AuthResponse> {
  return request('/v1/auth/password-reset/confirm', { method: 'POST', body: JSON.stringify(input) }, options);
}

export function fetchCurrentUser(token: string, options?: RequestOptions): Promise<UserSummary> {
  return request('/v1/auth/me', { method: 'GET' }, { ...options, token });
}

/**
 * OrganizationResponse가 아니라 새로운 AuthResponse를 반환한다 - 호출자가 이전에 가지고 있던 토큰에는
 * 아직 orgId claim이 없으므로(이 organization이 존재하기 전에 발급된 토큰이므로), 이후의 모든
 * org/class 호출은 새 토큰을 사용해야 하며 그러지 않으면 403이 발생한다. 호출자는 이 결과를
 * useAuth().setSession()에 넣어줘야 한다.
 */
export function createOrganization(
  token: string,
  input: { name: string },
  options?: RequestOptions,
): Promise<AuthResponse> {
  return request('/v1/organizations', { method: 'POST', body: JSON.stringify(input) }, { ...options, token });
}

export function fetchEntitlement(
  token: string,
  organizationId: string,
  options?: RequestOptions,
): Promise<EntitlementResponse> {
  return request(`/v1/organizations/${organizationId}/entitlement`, { method: 'GET' }, { ...options, token });
}

export function createClass(
  token: string,
  organizationId: string,
  input: { name: string; initialPassword: string },
  options?: RequestOptions,
): Promise<ClassResponse> {
  return request(
    `/v1/organizations/${organizationId}/classes`,
    { method: 'POST', body: JSON.stringify(input) },
    { ...options, token },
  );
}

export function listClasses(
  token: string,
  organizationId: string,
  options?: RequestOptions,
): Promise<ClassResponse[]> {
  return request(`/v1/organizations/${organizationId}/classes`, { method: 'GET' }, { ...options, token });
}

/** 소유자인 DIRECTOR 또는 그 class 자신의 CLASS_ACCOUNT - class-account 홈에서 자신의 joinCode를 보여줄 때 사용한다. */
export function fetchClass(
  token: string,
  classId: string,
  options?: RequestOptions,
): Promise<ClassResponse> {
  return request(`/v1/classes/${classId}`, { method: 'GET' }, { ...options, token });
}

export function createClassInvite(
  token: string,
  classId: string,
  options?: RequestOptions,
): Promise<ClassInviteResponse> {
  return request(`/v1/classes/${classId}/invites`, { method: 'POST' }, { ...options, token });
}

export function joinClass(
  input: {
    classCode?: string;
    inviteToken?: string;
    email: string;
    password: string;
    displayName: string;
  },
  options?: RequestOptions,
): Promise<AuthResponse> {
  return request('/v1/classes/join', { method: 'POST', body: JSON.stringify(input) }, options);
}
