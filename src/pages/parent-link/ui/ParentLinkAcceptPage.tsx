import { Navigate, useParams } from 'react-router-dom';

/**
 * 선생님의 부모 초대(코드/토큰) 수락 흐름은 이제 홈("/")의 OnboardingFlow로 흡수됐다 -
 * 기관 반코드 매칭(JoinClassPage → sign-up 스텝)과 겪는 경험을 맞추기 위해 예전 별도 페이지
 * (preview→account→consent 3단계 상태머신 + 독자 스타일)를 걷어내고 같은 패턴의 얇은
 * 리다이렉트로 남겼다. 라우트는 두 형태로 붙는다: "/tutor-invite/:token"과
 * "/tutor-invite/code/:code" - 어느 쪽이든 온 파라미터를 그대로 `?flow=tutor-invite`의
 * `token`/`code` 쿼리로 옮겨 싣는다(HomePage.readOnboardingParams가 읽는 계약).
 */
export function ParentLinkAcceptPage() {
  const { token: rawToken, code: rawCode } = useParams<{ token?: string; code?: string }>();
  const qs = new URLSearchParams({ flow: 'tutor-invite' });
  if (rawToken) qs.set('token', rawToken);
  else if (rawCode) qs.set('code', rawCode);
  return <Navigate to={`/?${qs.toString()}`} replace />;
}
