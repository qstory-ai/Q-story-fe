import { Navigate, useParams } from 'react-router-dom';

/**
 * 선생님의 부모 초대 링크("/tutor-invite/:token", "/tutor-invite/code/:code")를 홈("/")
 * OnboardingFlow의 `?flow=tutor-invite&token|code=` 쿼리로 넘긴다(HomePage.readOnboardingParams가 읽는 계약).
 */
export function ParentLinkAcceptPage() {
  const { token: rawToken, code: rawCode } = useParams<{ token?: string; code?: string }>();
  const qs = new URLSearchParams({ flow: 'tutor-invite' });
  if (rawToken) qs.set('token', rawToken);
  else if (rawCode) qs.set('code', rawCode);
  return <Navigate to={`/?${qs.toString()}`} replace />;
}
