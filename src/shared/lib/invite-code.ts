/**
 * 반/선생님/기관 초대 코드가 공유하는 형식 - 영문 대문자·숫자 4~16자리. 화면 4곳(반 코드,
 * 선생님 초대 코드, 기관 초대 코드 두 곳)이 각자 이 정규식을 하드코딩하고 있었는데, 백엔드가
 * 코드 형식을 바꾸면 네 곳을 전부 손으로 맞춰야 하는 게 위험해서 한 곳으로 모았다.
 */
const INVITE_CODE_PATTERN = /^[A-Z0-9]{4,16}$/;

/** 사용자가 입력/붙여넣은 코드를 검증 가능한 형태로 정규화한다 - 앞뒤 공백 제거 + 대문자화. */
export function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/** 정규화된(normalizeInviteCode를 거친) 코드가 유효한 형식인지 검사한다. */
export function isValidInviteCode(code: string): boolean {
  return INVITE_CODE_PATTERN.test(code);
}
