import { Navigate, useLocation } from 'react-router-dom';

import { loginRedirectPath } from './login-redirect';

/** `/login` 딥링크(이메일·북마크·외부 링크)를 홈("/") OnboardingFlow의 sign-in 스텝으로 넘긴다. next는 유지한다. */
export function LoginPage() {
  const { search } = useLocation();
  return <Navigate to={loginRedirectPath(search)} replace />;
}
