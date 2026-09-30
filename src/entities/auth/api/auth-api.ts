import { apiBaseUrl } from '@/shared/config';
import { requestJson, type RequestOptions as SharedRequestOptions } from '@/shared/api';

export type Role = 'DIRECTOR' | 'PARENT' | 'TUTOR' | 'STAFF';

export type SubscriptionStatus = 'NONE' | 'TRIALING' | 'ACTIVE' | 'EXPIRED';

export type UserSummary = {
  id: string;
  role: Role;
  loginId: string;
  /** 로그인 식별자가 아니라 연락용 이메일. */
  email: string | null;
  displayName: string;
  /** 기관 관리자(DIRECTOR)의 기관 - 다른 역할은 항상 null. */
  organizationId: string | null;
  /** 학부모 개인 구독 상태 - DIRECTOR는 항상 NONE. */
  subscriptionStatus: SubscriptionStatus;
  /** 백엔드가 이미 기관 구독과 개인 구독을 OR로 합쳐 계산해 준 값 - 프론트에서 다시 판단하지 않는다. */
  grantsAccess: boolean;
  /** PARENT 역할에서만 의미가 있다 - 다른 역할은 항상 null. */
  childName: string | null;
  /** A public tutor-image URL, null until a tutor uploads one. */
  profileImageUrl: string | null;
  /** Server-issued expiry for a paid personal subscription; null for non-paid/organization access. */
  subscriptionExpiresAt: string | null;
};

export type AuthResponse = {
  token: string;
  user: UserSummary;
};

export type EntitlementResponse = {
  subscriptionStatus: SubscriptionStatus;
  grantsAccess: boolean;
  subscriptionExpiresAt: string | null;
};

export type ClassResponse = {
  id: string;
  organizationId: string | null;
  /** 담임 선생님 - 기관 반에서 아직 배정하지 않았으면 null. */
  tutorId: string | null;
  name: string;
  joinCode: string;
  createdAt: string;
};

/** 반 상세의 학생 명단 한 줄. 학부모가 아직 연결되지 않은 학생은 parentDisplayName이 null. */
export type ClassStudentResponse = {
  id: string;
  name: string;
  ageBand: string;
  status: 'PENDING_PARENT' | 'CONFIRMED';
  parentDisplayName: string | null;
  parentEmail: string | null;
  createdAt: string;
};

/** 학부모가 "내 아이가 들어가 있는 반" 목록에서 보는 한 줄. */
export type ClassMembershipResponse = {
  studentId: string;
  studentName: string;
  classId: string | null;
  className: string | null;
  organizationName: string | null;
  tutorDisplayName: string | null;
};

export type RequestOptions = SharedRequestOptions;

/**
 * The backend's failure envelope is {ok:false, failure:{code, stage, retryable, safeDetail}} -
 * safeDetail is written to be shown directly to a user, so form error messages surface it as-is
 * rather than a generic "HTTP 4xx" string. story-registry.ts's StoryLoadError does the same for
 * the story load screen. requestJson() (shared/api) does the actual fetch + envelope parsing;
 * this module keeps its own error class so callers can `instanceof`-check it.
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

function request<T>(path: string, init: RequestInit, options: RequestOptions = {}): Promise<T> {
  return requestJson(AuthApiError, path, init, { baseUrl: apiBaseUrl, ...options });
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

/** 선생님 - 1:1 수업을 진행하는 셀프서비스 역할. 조직/반 없이 바로 가입된다. */
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

export function uploadProfileImage(
  token: string,
  image: File,
  options?: RequestOptions,
): Promise<UserSummary> {
  const form = new FormData();
  form.append('image', image);
  return request('/v1/auth/me/profile-image', { method: 'POST', body: form }, { ...options, token });
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
  input: { name: string; homeroomTutorId?: string },
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

/** 반을 볼 수 있는 사람은 그 기관의 원장과 담임 선생님뿐이다. */
export function fetchClass(
  token: string,
  classId: string,
  options?: RequestOptions,
): Promise<ClassResponse> {
  return request(`/v1/classes/${classId}`, { method: 'GET' }, { ...options, token });
}

export function listClassStudents(
  token: string,
  classId: string,
  options?: RequestOptions,
): Promise<ClassStudentResponse[]> {
  return request(`/v1/classes/${classId}/students`, { method: 'GET' }, { ...options, token });
}

/** 담임이 없는 반에 담임을 배정한다 - 그때까지 명단에 올라온 학생이 그 선생님의 학생이 된다. */
export function assignClassHomeroom(
  token: string,
  classId: string,
  tutorId: string,
  options?: RequestOptions,
): Promise<ClassResponse> {
  return request(
    `/v1/classes/${classId}/homeroom`,
    { method: 'PUT', body: JSON.stringify({ tutorId }) },
    { ...options, token },
  );
}

/** 반 코드로 학부모 계정을 만들고 아이를 그 반의 학생으로 올린다 - 아이 이름과 출생연도가 필요하다. */
export function joinClass(
  input: {
    classCode: string;
    loginId: string;
    email: string;
    password: string;
    displayName: string;
    childName: string;
    childBirthYear: number;
  },
  options?: RequestOptions,
): Promise<AuthResponse> {
  return request('/v1/classes/join', { method: 'POST', body: JSON.stringify(input) }, options);
}

/** 이미 계정이 있는 학부모가 반 코드로 아이를 한 명 더 올린다 - 아이마다 한 번씩 호출한다. */
export function joinExistingClass(
  token: string,
  input: { classCode: string; childName: string; childBirthYear: number },
  options?: RequestOptions,
): Promise<AuthResponse> {
  return request(
    '/v1/classes/join-existing',
    { method: 'POST', body: JSON.stringify(input) },
    { ...options, token },
  );
}

export function listClassMemberships(token: string, options?: RequestOptions): Promise<ClassMembershipResponse[]> {
  return request('/v1/classes/memberships', { method: 'GET' }, { ...options, token });
}

/** 아이를 반에서 뺀다 - 지난 수업 기록은 그대로 남는다. */
export function leaveClass(token: string, studentId: string, options?: RequestOptions): Promise<void> {
  return request(`/v1/classes/memberships/${studentId}`, { method: 'DELETE' }, { ...options, token, parseResponse: false });
}
