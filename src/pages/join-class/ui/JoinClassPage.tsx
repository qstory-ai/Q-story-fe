import { Navigate } from 'react-router-dom';

/** `/join` 딥링크를 홈의 학부모 회원가입(반 코드 입력 포함)으로 넘긴다. */
export function JoinClassPage() {
  return <Navigate to="/?flow=sign-up&role=parent" replace />;
}
