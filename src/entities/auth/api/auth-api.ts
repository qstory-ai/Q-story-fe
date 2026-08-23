import { readEnv } from '@/shared/config';

const apiBaseUrl = readEnv('VITE_QSTORY_API_URL');

export type Role = 'DIRECTOR' | 'CLASS_ACCOUNT' | 'PARENT';

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
 * The backend's failure envelope is {ok:false, failure:{code, stage, retryable, safeDetail}} -
 * safeDetail is written to be shown directly to a user, so form error messages surface it as-is
 * rather than a generic "HTTP 4xx" string (unlike story-registry.ts's fetch, whose failures are
 * never shown to a user directly).
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

export function signupDirector(
  input: { email: string; password: string; displayName: string },
  options?: RequestOptions,
): Promise<AuthResponse> {
  return request('/v1/auth/signup/director', { method: 'POST', body: JSON.stringify(input) }, options);
}

export function login(
  input: { loginId: string; password: string },
  options?: RequestOptions,
): Promise<AuthResponse> {
  return request('/v1/auth/login', { method: 'POST', body: JSON.stringify(input) }, options);
}

export function fetchCurrentUser(token: string, options?: RequestOptions): Promise<UserSummary> {
  return request('/v1/auth/me', { method: 'GET' }, { ...options, token });
}

/**
 * Returns a fresh AuthResponse, not an OrganizationResponse - the caller's prior token has no
 * orgId claim yet (issued before this organization existed), so every org/class call after this
 * one needs the new token or it 403s. Callers must feed this into useAuth().setSession().
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

/** The owning DIRECTOR or that class's own CLASS_ACCOUNT - used by the class-account home to show its own joinCode. */
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
