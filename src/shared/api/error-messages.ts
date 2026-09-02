/**
 * BE의 ErrorCode(백엔드 common/error/ErrorCode.java)에 대응하는 사용자용 메시지 사전.
 *
 * BE는 대부분의 실패에 대해 safeDetail을 이미 실어 보낸다 - 그 값이 있으면 우선 그것을 쓴다.
 * safeDetail이 없거나 사용자 표현으로 부적절할 때(예: 라틴어/기술 용어)만 이 사전이 대체
 * 카피를 제공한다. 여기에도 code가 없으면 status 기반 fallback으로 넘어간다.
 *
 * Copy 원칙:
 *  - 무엇이 실패했는지 명확히 (계정을 못 찾음 / 코드가 만료됨 / 이미 사용됨 등)
 *  - 무엇을 할 수 있는지 짧게 (다시 시도 / 다른 코드 요청 / 로그인 이동 등)
 *  - "요청을 처리하지 못했어요" 같은 모호한 문구는 마지막 fallback에서만
 */

/**
 * 각 에러 클래스가 갖는 공통 shape - AuthApiError/StoryApiError/TutorApiError 등 여러
 * 도메인 에러 클래스가 code/status/message 세 필드를 갖도록 정의돼 있어 함께 처리한다.
 */
export type ApiErrorLike = {
  message?: string;
  code?: string;
  status?: number;
};

const CODE_MESSAGES: Record<string, string> = {
  // ---- auth (login/signup)
  INVALID_CREDENTIALS: '아이디 또는 비밀번호가 맞지 않아요.',
  LOGIN_ID_ALREADY_REGISTERED: '이미 사용 중인 아이디예요. 다른 아이디로 시도해 주세요.',
  OAUTH_TOKEN_INVALID: '소셜 로그인 확인이 만료됐어요. 다시 로그인해 주세요.',
  OAUTH_ROLE_REQUIRED: '소셜 가입에는 가입 유형(학부모/기관/선생님) 선택이 필요해요.',
  OAUTH_EMAIL_ALREADY_REGISTERED: '이 이메일은 이미 다른 계정으로 가입돼 있어요. 그 계정으로 로그인해 주세요.',
  OAUTH_PROVIDER_NOT_CONFIGURED: '이 소셜 로그인은 아직 열리지 않았어요. 다른 방법으로 로그인해 주세요.',
  UNAUTHENTICATED: '로그인이 필요해요. 다시 로그인 후 시도해 주세요.',
  FORBIDDEN: '이 작업을 수행할 권한이 없어요.',
  VALIDATION_FAILED: '입력한 값을 다시 확인해 주세요.',
  INVALID_PASSWORD_RESET_TOKEN: '비밀번호 재설정 링크가 만료됐거나 이미 사용됐어요. 다시 요청해 주세요.',

  // ---- invites & join
  INVALID_INVITE: '초대 링크가 만료됐거나 이미 사용됐어요. 발급한 분께 다시 요청해 주세요.',
  INVALID_JOIN_CODE: '반 코드가 올바르지 않아요. 대소문자와 오타를 확인해 주세요.',

  // ---- organization / class
  ORGANIZATION_ALREADY_EXISTS: '이미 등록된 기관이 있어요.',
  ORGANIZATION_NOT_CREATED: '기관 정보를 찾지 못했어요. 기관 등록부터 다시 진행해 주세요.',

  // ---- entitlement / limits
  ENTITLEMENT_REQUIRED: '이 이야기는 구독 후 열려요.',
  RATE_LIMITED: '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.',
  COMPANION_CHAT_RATE_LIMITED: '대화가 너무 자주 이어졌어요. 잠시 쉬었다가 이어가 주세요.',
  PAYLOAD_TOO_LARGE: '보내는 데이터가 너무 커요. 좀 더 짧게 만들어 주세요.',
  AUDIO_TOO_LARGE: '녹음 파일이 너무 커요. 조금 더 짧게 녹음해 주세요.',
  NARRATION_REQUEST_TOO_LARGE: '보내는 문장이 너무 길어요.',

  // ---- resource
  NOT_FOUND: '요청한 항목을 찾지 못했어요.',
  STORY_NOT_REGISTERED: '이야기를 찾지 못했어요. 이야기가 회수됐거나 링크가 잘못됐을 수 있어요.',
  STORY_NOT_AVAILABLE: '이 이야기는 지금 이용할 수 없어요.',
  STALE_REVISION: '다른 창에서 먼저 저장된 내용이 있어요. 새로고침 후 다시 저장해 주세요.',

  // ---- infra / audio quality
  STORAGE_FAILED: '파일을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.',
  UNSUPPORTED_AUDIO_TYPE: '지원하지 않는 오디오 형식이에요.',
  EMPTY_AUDIO: '녹음이 비어 있어요. 다시 말해 주세요.',
  UNSUPPORTED_CONTENT_TYPE: '지원하지 않는 형식이에요.',
  INVALID_JSON: '요청 형식이 잘못됐어요.',

  // ---- consent
  CONSENT_INVALID: '동의 정보를 다시 확인해 주세요.',
  INVALID_CONSENT_TIME: '동의 시각이 유효하지 않아요.',

  // ---- server / catch-all
  INTERNAL_ERROR: '서버가 잠깐 문제가 생겼어요. 잠시 후 다시 시도해 주세요.',
};

/**
 * HTTP 상태 코드 기반 fallback. code와 safeDetail이 둘 다 없을 때 마지막으로 걸린다.
 * 400/401/403/404/409/410/413/429/5xx 각각 다른 카피를 준다.
 */
function messageForStatus(status: number | undefined): string {
  if (!status) return '네트워크 상태를 확인해 주세요.';
  if (status >= 500) return '서버가 잠깐 문제가 생겼어요. 잠시 후 다시 시도해 주세요.';
  if (status === 429) return '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.';
  if (status === 413) return '보내는 데이터가 너무 커요.';
  if (status === 410) return '이 링크는 만료됐거나 이미 사용됐어요.';
  if (status === 409) return '이미 등록된 정보와 충돌해요.';
  if (status === 404) return '요청한 항목을 찾지 못했어요.';
  if (status === 403) return '이 작업을 수행할 권한이 없어요.';
  if (status === 402) return '이 이야기는 구독 후 열려요.';
  if (status === 401) return '로그인이 필요해요.';
  if (status === 400) return '요청을 확인해 주세요. 입력값이 올바르지 않을 수 있어요.';
  return '요청을 처리하지 못했어요.';
}

/**
 * 순서: 도메인 카피 사전(code) → BE의 safeDetail(error.message) → HTTP 상태 fallback → 최후의 default.
 * BE가 이미 사람 친화 문구를 실어 보내는 경우가 많으니 safeDetail을 대체하지 말고 존중한다.
 */
export function messageForError(error: unknown, fallback?: string): string {
  const apiError = normalizeApiError(error);
  if (apiError) {
    if (apiError.code && CODE_MESSAGES[apiError.code]) return CODE_MESSAGES[apiError.code];
    if (apiError.message && apiError.message.trim().length > 0) return apiError.message;
    return messageForStatus(apiError.status);
  }
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return fallback ?? '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.';
}

function normalizeApiError(error: unknown): ApiErrorLike | null {
  if (!error || typeof error !== 'object') return null;
  const err = error as ApiErrorLike;
  if (typeof err.code === 'string' || typeof err.status === 'number' || typeof err.message === 'string') {
    return err;
  }
  return null;
}
