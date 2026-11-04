/**
 * 없어진 경로 → 지금 경로. 화면을 합치며 사라진 마이페이지 경로(UX 정리 4번)와 선생님·기관 화면의 옛 경로(Q-35)가 한 표에 있다.
 * 북마크·알림·외부 링크로 옛 경로가 열려도 막다른 길 없이 새 화면으로 간다(replace라 뒤로가기에 옛 경로가 남지 않는다).
 * 예전 /tutor/classes(수업 목록)는 이제 반·학생 목록이라 옮기지 않는다 - 그 자리가 새 화면이다.
 */
export const LEGACY_REDIRECTS: ReadonlyArray<readonly [from: string, to: string]> = [
  ['/mypage/profile', '/mypage/account'],
  ['/mypage/notifications', '/mypage/settings'],
  ['/mypage/privacy', '/mypage/settings'],
  ['/tutor/students', '/tutor/classes'],
  ['/tutor/class-groups', '/tutor/classes'],
  ['/tutor/class-groups/new', '/tutor/classes/new'],
  ['/organization/usage', '/organization/reports'],
];

/** 경로 안에 id가 든 옛 경로 - 라우트 패턴과, 실제 경로를 새 경로로 바꾸는 규칙. */
export const LEGACY_REDIRECT_PATTERNS: ReadonlyArray<{
  readonly route: string;
  readonly match: RegExp;
  readonly to: (match: RegExpMatchArray) => string;
}> = [
  { route: '/tutor/class-groups/:classId', match: /^\/tutor\/class-groups\/([^/]+)$/, to: (m) => `/tutor/classes/${m[1]}` },
];

/** App.tsx가 LegacyRedirect로 거는 라우트 경로 전부. */
export const LEGACY_ROUTE_PATHS: readonly string[] = [
  ...LEGACY_REDIRECTS.map(([from]) => from),
  ...LEGACY_REDIRECT_PATTERNS.map((pattern) => pattern.route),
];

/** 옛 경로면 새 경로, 아니면 null. 끝의 슬래시는 무시한다. */
export function legacyRedirectPath(pathname: string): string | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const exact = LEGACY_REDIRECTS.find(([from]) => from === path);
  if (exact) return exact[1];
  for (const pattern of LEGACY_REDIRECT_PATTERNS) {
    const match = path.match(pattern.match);
    if (match) return pattern.to(match);
  }
  return null;
}
