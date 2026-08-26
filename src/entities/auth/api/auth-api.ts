import { readEnv } from '@/shared/config';

const apiBaseUrl = readEnv('VITE_QSTORY_API_URL');

export type Role = 'DIRECTOR' | 'CLASS_ACCOUNT' | 'PARENT' | 'TUTOR' | 'STAFF';

export type UserSummary = {
  id: string;
  role: Role;
  loginId: string;
  /** 로그인 식별자가 아니라 연락용 이메일 - CLASS_ACCOUNT는 이메일을 받지 않아 null일 수 있다. */
  email: string | null;
  displayName: string;
  organizationId: string | null;
  classId: string | null;
  /** 학부모 개인 구독 상태(NONE/TRIALING/ACTIVE/EXPIRED) - DIRECTOR/CLASS_ACCOUNT는 항상 NONE. */
  subscriptionStatus: 'NONE' | 'TRIALING' | 'ACTIVE' | 'EXPIRED';
  /** 백엔드가 이미 기관 구독과 개인 구독을 OR로 합쳐 계산해 준 값 - 프론트에서 다시 판단하지 않는다. */
  grantsAccess: boolean;
  /** PARENT 역할에서만 의미가 있다 - 다른 역할은 항상 null. */
  childName: string | null;
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
 * rather than a generic "HTTP 4xx" string. story-registry.ts's StoryLoadError does the same for
 * the story load screen.
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
  input: { loginId: string; email: string; password: string; displayName: string },
  options?: RequestOptions,
): Promise<AuthResponse> {
  return request('/v1/auth/signup/organization', { method: 'POST', body: JSON.stringify(input) }, options);
}

/** 반 코드 없이 가입하는 "독립" 학부모용 - 반 코드로 가입하려면 joinClass()를 대신 쓴다. */
export function signupParent(
  input: { loginId: string; email: string; password: string; displayName: string },
  options?: RequestOptions,
): Promise<AuthResponse> {
  return request('/v1/auth/signup/parent', { method: 'POST', body: JSON.stringify(input) }, options);
}

/** 방문 선생님 - 가정을 방문해 1:1 수업을 진행하는 셀프서비스 역할. 조직/반 없이 바로 가입된다. */
export function signupTutor(
  input: { loginId: string; email: string; password: string; displayName: string },
  options?: RequestOptions,
): Promise<AuthResponse> {
  return request('/v1/auth/signup/tutor', { method: 'POST', body: JSON.stringify(input) }, options);
}

export function login(
  input: { loginId: string; password: string },
  options?: RequestOptions,
): Promise<AuthResponse> {
  return request('/v1/auth/login', { method: 'POST', body: JSON.stringify(input) }, options);
}

/**
 * 구글/카카오 소셜 로그인·가입 - token은 provider마다 의미가 다르다(구글은 Google Identity
 * Services의 id_token, 카카오는 카카오 JS SDK의 access token - google-identity.ts/kakao-sdk.ts
 * 참고). role은 이 provider 계정으로 처음 가입하는 경우에만 필요하고, 이미 연결된 계정으로
 * 로그인할 때는 백엔드가 무시한다.
 */
export function oauthLogin(
  provider: 'GOOGLE' | 'KAKAO',
  input: { token: string; role?: Role },
  options?: RequestOptions,
): Promise<AuthResponse> {
  const path = provider === 'GOOGLE' ? '/v1/auth/oauth/google' : '/v1/auth/oauth/kakao';
  return request(path, { method: 'POST', body: JSON.stringify(input) }, options);
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

/** displayName은 모든 역할에 필수. childName은 PARENT가 아니면 백엔드가 조용히 무시한다. */
export function updateProfile(
  token: string,
  input: { displayName: string; childName?: string | null },
  options?: RequestOptions,
): Promise<UserSummary> {
  return request('/v1/auth/me/profile', { method: 'POST', body: JSON.stringify(input) }, { ...options, token });
}

/** "비밀번호를 잊어버렸을 때" 쓰는 confirmPasswordReset()과 달리, 로그인된 상태에서 현재 비밀번호로 바로 바꾼다. */
export function changePassword(
  token: string,
  input: { currentPassword: string; newPassword: string },
  options?: RequestOptions,
): Promise<void> {
  return request('/v1/auth/me/password', { method: 'POST', body: JSON.stringify(input) }, { ...options, token });
}

/** 소프트 삭제 - 성공하면 이 토큰은 더 이상 쓸 수 없다. 호출한 쪽에서 곧바로 useAuth().logout()을 호출해야 한다. */
export function deleteAccount(
  token: string,
  input: { reasonCategory: string; reasonDetail?: string },
  options?: RequestOptions,
): Promise<void> {
  return request('/v1/auth/me/delete', { method: 'POST', body: JSON.stringify(input) }, { ...options, token });
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
    loginId: string;
    email: string;
    password: string;
    displayName: string;
  },
  options?: RequestOptions,
): Promise<AuthResponse> {
  return request('/v1/classes/join', { method: 'POST', body: JSON.stringify(input) }, options);
}
