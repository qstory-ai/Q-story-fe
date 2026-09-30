import { Navigate } from 'react-router-dom';

/** `/login` 딥링크(이메일·북마크·외부 링크)를 홈("/") OnboardingFlow의 sign-in 스텝으로 넘긴다. */
export function LoginPage() {
  return <Navigate to="/?flow=sign-in" replace />;
}
