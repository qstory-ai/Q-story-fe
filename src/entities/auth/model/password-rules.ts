/**
 * 비밀번호 최소 길이 - 가입(onboarding-flow), 재설정(ResetPasswordPage), 계정 관리(MyPageAccountPage)
 * 세 폼이 같은 규칙을 쓰도록 한 곳에 둔다. 백엔드 AuthValidator와 같은 값이어야 한다.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_TOO_SHORT_MESSAGE = `${PASSWORD_MIN_LENGTH}자 이상 입력해 주세요.`;
export const PASSWORD_RULE_HINT = `${PASSWORD_MIN_LENGTH}자 이상`;

export function isPasswordLongEnough(password: string) {
  return password.length >= PASSWORD_MIN_LENGTH;
}
