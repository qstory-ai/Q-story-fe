import { apiBaseUrl } from '@/shared/config';
import { requestJson, type RequestOptions } from '@/shared/api';

import type { ConsentPayload } from '../model/consent';

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
  /** 지난 담임(예전에 맡았던 선생님)에게는 null - 더 이상 보호자를 들일 수 없다. */
  joinCode: string | null;
  createdAt: string;
  /** 지난 반으로 보관한 시각. 지금 쓰는 반이면 null(옛 서버 응답에는 없을 수 있다). */
  archivedAt?: string | null;
};

/** 반 소속 구간이 끝난 이유 - MOVED 다른 반으로 옮김, GRADUATED 수료, KEPT 같은 반에 그대로(학기 마무리). */
export type ClassMembershipEndReason = 'MOVED' | 'GRADUATED' | 'KEPT';

/** 반 상세의 학생 명단 한 줄. 학부모가 아직 연결되지 않은 학생은 parentDisplayName이 null. */
export type ClassStudentResponse = {
  id: string;
  name: string;
  ageBand: string;
  status: 'PENDING_PARENT' | 'CONFIRMED';
  parentDisplayName: string | null;
  parentEmail: string | null;
  createdAt: string;
  /** 수료한 학생이면 그 시각. */
  graduatedAt?: string | null;
  /** 지난 학생(includePast)만 - 이 반을 떠난 시각과 이유. 지금 학생은 null. */
  endedAt?: string | null;
  endReason?: ClassMembershipEndReason | null;
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

/** requestJson()(shared/api)이 실패 봉투를 파싱해 던지는 에러 - 호출부가 instanceof로 구분할 수 있게 도메인별 클래스를 둔다. */
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
  input: { loginId: string; email: string; password: string; displayName: string; consents: ConsentPayload },
  options?: RequestOptions,
): Promise<AuthResponse> {
  return request('/v1/auth/signup/organization', { method: 'POST', body: JSON.stringify(input) }, options);
}

/** 반 코드 없이 가입하는 "독립" 학부모용 - 반 코드로 가입하려면 joinClass()를 대신 쓴다. */
export function signupParent(
  input: { loginId: string; email: string; password: string; displayName: string; consents: ConsentPayload },
  options?: RequestOptions,
): Promise<AuthResponse> {
  return request('/v1/auth/signup/parent', { method: 'POST', body: JSON.stringify(input) }, options);
}

/** 선생님 - 1:1 수업을 진행하는 셀프서비스 역할. 조직/반 없이 바로 가입된다. */
export function signupTutor(
  input: { loginId: string; email: string; password: string; displayName: string; consents: ConsentPayload },
  options?: RequestOptions,
): Promise<AuthResponse> {
  return request('/v1/auth/signup/tutor', { method: 'POST', body: JSON.stringify(input) }, options);
}

/** rememberMe(기본 true) - false면 짧은 토큰(백엔드 qstory.auth.session-ttl-hours)을 받고 sessionStorage에 둔다(session.ts). */
export function login(
  input: { loginId: string; password: string; rememberMe?: boolean },
  options?: RequestOptions,
): Promise<AuthResponse> {
  return request('/v1/auth/login', { method: 'POST', body: JSON.stringify(input) }, options);
}

/**
 * 구글/카카오 소셜 로그인·가입 - token은 provider마다 의미가 다르다(구글은 Google Identity
 * Services의 id_token, 카카오는 카카오 JS SDK의 access token - google-identity.ts/kakao-sdk.ts
 * 참고). role은 이 provider 계정으로 처음 가입하는 경우에만 필요하고, 이미 연결된 계정으로
 * 로그인할 때는 백엔드가 무시한다. rememberMe는 이미 연결된 계정으로 로그인할 때만 쓰이고, 처음 가입하면
 * 다른 회원가입처럼 항상 로그인 유지 토큰이 온다.
 */
export function oauthLogin(
  provider: 'GOOGLE' | 'KAKAO',
  input: { token: string; role?: Role; consents?: ConsentPayload; rememberMe?: boolean },
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

/** 지금 토큰과 같은 모드(로그인 유지 여부)의 새 토큰을 받는다 - 만료가 가까울 때 current-user.tsx가 부른다. 만료·탈퇴면 401. */
export function refreshToken(token: string, options?: RequestOptions): Promise<AuthResponse> {
  return request('/v1/auth/refresh', { method: 'POST' }, { ...options, token });
}

export function fetchCurrentUser(token: string, options?: RequestOptions): Promise<UserSummary> {
  return request('/v1/auth/me', { method: 'GET' }, { ...options, token });
}

export type ConsentRecordType = 'TERMS' | 'PRIVACY' | 'MARKETING' | 'CHILD_REPORT_SCOPE' | 'VOICE_RAW';
export type ConsentRecordSource = 'SIGNUP' | 'OAUTH_SIGNUP' | 'CLASS_JOIN_SIGNUP' | 'ONBOARDING' | 'MYPAGE';

/** 로그인한 계정의 동의 이력을 남긴다(204). 온보딩 동의 단계와 마이페이지가 쓴다. */
export function recordConsents(
  token: string,
  input: { source: ConsentRecordSource; items: { type: ConsentRecordType; agreed: boolean; version: string }[] },
  options?: RequestOptions,
): Promise<void> {
  return request('/v1/me/consents', { method: 'POST', body: JSON.stringify(input) }, { ...options, token });
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
  input: { name: string },
  options?: RequestOptions,
): Promise<ClassResponse> {
  return request(
    `/v1/organizations/${organizationId}/classes`,
    { method: 'POST', body: JSON.stringify(input) },
    { ...options, token },
  );
}

/** 기관의 반 목록. includeArchived면 지난 반(archivedAt이 채워진 반)도 함께 온다. */
export function listClasses(
  token: string,
  organizationId: string,
  filters?: { includeArchived?: boolean },
  options?: RequestOptions,
): Promise<ClassResponse[]> {
  const query = filters?.includeArchived ? '?includeArchived=true' : '';
  return request(`/v1/organizations/${organizationId}/classes${query}`, { method: 'GET' }, { ...options, token });
}

/** 반을 볼 수 있는 사람은 그 기관의 원장과 담임 선생님뿐이다. */
export function fetchClass(
  token: string,
  classId: string,
  options?: RequestOptions,
): Promise<ClassResponse> {
  return request(`/v1/classes/${classId}`, { method: 'GET' }, { ...options, token });
}

/** 반 학생 명단. includePast면 이 반을 떠난 학생(옮김·수료)도 뒤에 붙는다(endedAt·endReason이 채워진 줄). */
export function listClassStudents(
  token: string,
  classId: string,
  filters?: { includePast?: boolean },
  options?: RequestOptions,
): Promise<ClassStudentResponse[]> {
  const query = filters?.includePast ? '?includePast=true' : '';
  return request(`/v1/classes/${classId}/students${query}`, { method: 'GET' }, { ...options, token });
}

/**
 * 담임을 배정하거나 바꾼다(관리자만). 명단 학생과 아직 시작하지 않은 수업은 새 담임에게 넘어가고, 지난 수업과
 * 리포트는 그때 진행한 선생님 것으로 남는다.
 */
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

/** 반 담임 이력 한 구간. endedAt이 null이면 지금 담임. */
export type HomeroomHistoryEntry = {
  tutorId: string;
  tutorDisplayName: string;
  startedAt: string;
  endedAt: string | null;
};

/** 반 담임 이력(관리자만) - 오래된 순. */
export function listClassHomeroomHistory(
  token: string,
  classId: string,
  options?: RequestOptions,
): Promise<HomeroomHistoryEntry[]> {
  return request(`/v1/classes/${classId}/homeroom-history`, { method: 'GET' }, { ...options, token });
}

/** 반 학생 상세의 리포트 한 줄 - 그 수업을 진행한 선생님이 함께 온다. */
export type ClassStudentReport = {
  id: string;
  storyId: string;
  completedAt: string;
  durationSeconds: number | null;
  sessionKind: 'CLASS' | 'TUTOR' | 'HOME';
  lessonId: string | null;
  tutorId: string;
  tutorDisplayName: string;
  /** 수업한 반과 그때 반 이름 - 반을 옮긴 학생은 지난 반 기록도 함께 온다. 옛 서버 응답에는 없을 수 있다. */
  classId?: string | null;
  className?: string | null;
};

/** 반 학생 한 명의 수업 리포트. 관리자는 담임이 바뀌기 전 기록까지 전부, 담임은 자기가 진행한 것만 받는다. */
export function listClassStudentReports(
  token: string,
  classId: string,
  studentId: string,
  options?: RequestOptions,
): Promise<ClassStudentReport[]> {
  return request(`/v1/classes/${classId}/students/${studentId}/reports`, { method: 'GET' }, { ...options, token });
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
    consents: ConsentPayload;
    /** 이름이 명단과 달라도 명단의 이 학생과 잇는다(listClassRosterByCode의 id). */
    rosterStudentId?: string;
  },
  options?: RequestOptions,
): Promise<AuthResponse> {
  return request('/v1/classes/join', { method: 'POST', body: JSON.stringify(input) }, options);
}

/** 반 초대 링크(/join?code=)를 연 학부모가 가입·로그인 전에 보는 정보. */
export type ClassPreview = {
  classCode: string;
  className: string;
  /** 기관 없이 선생님이 운영하는 반이면 null. */
  organizationName: string | null;
  /** 담임이 아직 없는 기관 반이면 null. */
  tutorDisplayName: string | null;
};

export function previewClassByCode(classCode: string, options?: RequestOptions): Promise<ClassPreview> {
  return request(`/v1/classes/by-code/${encodeURIComponent(classCode)}`, { method: 'GET' }, options);
}

/** 반 명단 중 아직 학부모가 없는 학생(이름만) - 아이 이름이 명단과 다를 때 학부모가 우리 아이를 고른다. */
export type ClassRosterEntry = { id: string; name: string };

export function listClassRosterByCode(classCode: string, options?: RequestOptions): Promise<ClassRosterEntry[]> {
  return request(`/v1/classes/by-code/${encodeURIComponent(classCode)}/roster`, { method: 'GET' }, options);
}

/**
 * 이미 계정이 있는 학부모가 반 코드로 아이를 한 명 더 올린다 - 아이마다 한 번씩 호출한다. 이미 등록한 아이는
 * childId로 고르고(이름·출생연도는 그 아이 것), 새 아이는 childName·childBirthYear를 보낸다.
 */
export function joinExistingClass(
  token: string,
  input: ({ classCode: string; childId: string } | { classCode: string; childName: string; childBirthYear: number }) & {
    /** 이름이 명단과 달라도 명단의 이 학생과 잇는다(listClassRosterByCode의 id). */
    rosterStudentId?: string;
  },
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
