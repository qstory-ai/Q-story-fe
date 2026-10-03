import type { Role, UserSummary } from '../api/auth-api';
import { ORGANIZATION_PATHS, TUTOR_PATHS } from './app-paths';
import { homePathFor } from './home-path';

export type DashboardNavKey = 'home' | 'library' | 'classes' | 'lessons' | 'tutors' | 'reports' | 'mypage';

// entities 레이어는 shared/ui 컴포넌트에 의존하지 않는다 - AppNavShellItem과 구조적으로
// 호환되는 형태(key/label/icon/active/onPress)만 여기서 만들고, 실제 컴포넌트 타입에 대한
// 할당 가능 여부는 이걸 <AppNavShell items={...}> 로 넘기는 호출부에서 구조적으로 검사된다.
type DashboardNavIcon = 'home' | 'book' | 'graduationCap' | 'report' | 'user' | 'users' | 'calendarDays';

const COMMON_TABS: Array<[string, DashboardNavKey]> = [
  ['/mypage', 'mypage'],
  ['/payment', 'mypage'],
];

/**
 * 역할별 "경로 접두사 → 탭". 가장 긴 접두사가 이긴다. 예전 경로(/tutor/students, /tutor/class-groups,
 * /organization/usage)는 App의 리다이렉트로 새 경로로 옮겨지지만, 리다이렉트 직전 한 번의 렌더에서도 같은 탭이
 * 강조되도록 남겨 둔다.
 */
const PATH_TABS: Record<Role, Array<[string, DashboardNavKey]>> = {
  PARENT: [
    ['/parent', 'home'],
    ['/library', 'library'],
    ['/stories', 'library'],
    ['/reports', 'reports'],
    ...COMMON_TABS,
  ],
  TUTOR: [
    ['/tutor', 'home'],
    ['/tutor/library', 'library'],
    ['/stories', 'library'],
    ['/tutor/classes', 'classes'],
    ['/tutor/students', 'classes'],
    ['/tutor/class-groups', 'classes'],
    ['/tutor/lessons', 'lessons'],
    ['/tutor/reports', 'reports'],
    ['/reports', 'reports'],
    ['/tutor/join-organization', 'mypage'],
    ...COMMON_TABS,
  ],
  DIRECTOR: [
    ['/organization', 'home'],
    ['/stories', 'home'],
    ['/organization/classes', 'classes'],
    ['/organization/tutors', 'tutors'],
    ['/organization/usage', 'reports'],
    ['/organization/reports', 'reports'],
    ['/reports', 'reports'],
    ['/organization/subscription', 'mypage'],
    ...COMMON_TABS,
  ],
  STAFF: [['/staff', 'home'], ...COMMON_TABS],
};

export function navKeyForPath(role: Role, pathname: string): DashboardNavKey | null {
  let best: { length: number; key: DashboardNavKey } | null = null;
  for (const [prefix, key] of PATH_TABS[role] ?? []) {
    const matches = pathname === prefix || pathname.startsWith(`${prefix}/`);
    if (matches && (!best || prefix.length > best.length)) best = { length: prefix.length, key };
  }
  return best?.key ?? null;
}

/**
 * AppNavShell에 넣을 항목들. 보호자 4탭, 관리자 5탭(홈·반·학생·선생님·리포트·마이페이지 - 이용 현황은 리포트에
 * 합쳤다), 선생님 6탭(홈·반·학생·수업·서재·리포트·마이페이지)이다. STAFF는 각 화면이 자체 항목을 구성한다.
 */
export function dashboardNavItems(
  user: UserSummary,
  navigate: (path: string) => void,
  pathname: string,
): Array<{ key: DashboardNavKey; label: string; icon: DashboardNavIcon; active: boolean; onPress: () => void }> {
  const active = navKeyForPath(user.role, pathname);
  const entries: Array<{ key: DashboardNavKey; label: string; icon: DashboardNavIcon; path: string }> = [
    { key: 'home', label: '홈', icon: 'home', path: homePathFor(user) },
  ];
  if (user.role === 'PARENT') {
    entries.push({ key: 'library', label: '서재', icon: 'book', path: '/library' });
    entries.push({ key: 'reports', label: '리포트', icon: 'report', path: '/reports' });
  }
  if (user.role === 'TUTOR') {
    entries.push({ key: 'classes', label: '반·학생', icon: 'graduationCap', path: TUTOR_PATHS.classes });
    entries.push({ key: 'lessons', label: '수업', icon: 'calendarDays', path: TUTOR_PATHS.lessons });
    entries.push({ key: 'library', label: '서재', icon: 'book', path: '/tutor/library' });
    entries.push({ key: 'reports', label: '리포트', icon: 'report', path: '/tutor/reports' });
  }
  if (user.role === 'DIRECTOR') {
    entries.push({ key: 'classes', label: '반·학생', icon: 'graduationCap', path: '/organization/classes' });
    entries.push({ key: 'tutors', label: '선생님', icon: 'users', path: '/organization/tutors' });
    entries.push({ key: 'reports', label: '리포트', icon: 'report', path: ORGANIZATION_PATHS.reports });
  }
  entries.push({ key: 'mypage', label: '마이페이지', icon: 'user', path: '/mypage' });

  return entries.map((entry) => ({
    key: entry.key,
    label: entry.label,
    icon: entry.icon,
    active: entry.key === active,
    onPress: () => navigate(entry.path),
  }));
}
