/**
 * 화면을 합치며 없어진 경로 → 합쳐진 화면(UX 정리 4번). 북마크·알림·외부 링크로 옛 경로가 열려도
 * 막다른 길 없이 새 화면으로 간다(replace라 뒤로가기에 옛 경로가 남지 않는다).
 */
export const LEGACY_REDIRECTS: ReadonlyArray<readonly [from: string, to: string]> = [
  ['/mypage/profile', '/mypage/account'],
  ['/mypage/notifications', '/mypage/settings'],
  ['/mypage/privacy', '/mypage/settings'],
];
