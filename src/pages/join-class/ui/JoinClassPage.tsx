import { Navigate, useSearchParams } from 'react-router-dom';

/**
 * "학부모가 반 코드/초대로 가입" 흐름은 이제 홈("/")의 OnboardingFlow로 흡수됐다. `/join`은
 * PARENT role의 sign-up 스텝으로 곧장 이동시키는 얇은 리다이렉트로 남는다 - `?invite=<token>`
 * 이 있으면 그대로 넘겨주고, 없으면 sign-up의 기본값(hasClass=true)이 반 코드 입력을 붙여 준다.
 */
export function JoinClassPage() {
  const [searchParams] = useSearchParams();
  const invite = searchParams.get('invite');
  const qs = new URLSearchParams({ flow: 'sign-up', role: 'parent' });
  if (invite) qs.set('invite', invite);
  return <Navigate to={`/?${qs.toString()}`} replace />;
}
