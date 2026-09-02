import { Navigate, useSearchParams } from 'react-router-dom';

/**
 * 이전엔 별도 회원가입 화면이었지만, 홈("/")의 OnboardingFlow가 sign-up 스텝을 이미 갖고 있어
 * 여기서는 그쪽으로 리다이렉트한다. `?role=organization|parent|tutor`, `?invite=<token>`
 * 파라미터는 홈의 `?flow=sign-up&role=...&invite=...`로 변환해 그대로 넘겨준다. `/signup`
 * 딥링크(이메일·북마크·외부 링크)는 보존한다.
 */
export function SignupPage() {
  const [searchParams] = useSearchParams();
  const roleParam = searchParams.get('role');
  const invite = searchParams.get('invite');
  const qs = new URLSearchParams({ flow: 'sign-up' });
  // 초대 토큰이 있으면 role은 강제로 parent - ClassService.resolveClassGroup의 XOR 규약 상
  // classCode/inviteToken 중 정확히 하나만 실려 나가야 하며, invite는 PARENT만 지원한다.
  if (invite) {
    qs.set('role', 'parent');
    qs.set('invite', invite);
  } else if (roleParam) {
    qs.set('role', roleParam);
  }
  return <Navigate to={`/?${qs.toString()}`} replace />;
}
