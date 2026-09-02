import { Navigate } from 'react-router-dom';

/**
 * 이전엔 별도 로그인 화면이었지만, 홈("/")의 OnboardingFlow가 sign-in 스텝을 이미 갖고 있어
 * 여기서는 그쪽으로 리다이렉트한다. `/login` 딥링크(이메일·북마크·외부 링크)는 보존한다.
 */
export function LoginPage() {
  return <Navigate to="/?flow=sign-in" replace />;
}
