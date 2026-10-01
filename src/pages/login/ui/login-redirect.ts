/** `/login?next=` 딥링크의 next를 홈 로그인 흐름으로 넘긴다(검증은 홈의 safeNextPath가 한다). */
export function loginRedirectPath(search: string): string {
  const next = new URLSearchParams(search).get('next');
  const qs = new URLSearchParams({ flow: 'sign-in' });
  if (next) qs.set('next', next);
  return `/?${qs.toString()}`;
}
