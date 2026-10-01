import { Navigate, useSearchParams } from 'react-router-dom';

/** `/signup?role=organization|parent|tutor` 딥링크(이메일·북마크·외부 링크)를 홈의 회원가입 흐름으로 넘긴다. */
export function SignupPage() {
  const [searchParams] = useSearchParams();
  const roleParam = searchParams.get('role');
  const qs = new URLSearchParams({ flow: 'sign-up' });
  if (roleParam) qs.set('role', roleParam);
  const nextParam = searchParams.get('next');
  if (nextParam) qs.set('next', nextParam);
  return <Navigate to={`/?${qs.toString()}`} replace />;
}
