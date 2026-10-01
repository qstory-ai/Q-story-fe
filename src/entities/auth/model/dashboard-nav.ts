import type { Role, UserSummary } from '../api/auth-api';
import { homePathFor } from './home-path';

export type DashboardNavKey = 'home' | 'library' | 'classes' | 'tutors' | 'usage' | 'reports' | 'mypage';

// entities 레이어는 shared/ui 컴포넌트에 의존하지 않는다 - AppNavShellItem과 구조적으로
// 호환되는 형태(key/label/icon/active/onPress)만 여기서 만들고, 실제 컴포넌트 타입에 대한
// 할당 가능 여부는 이걸 <AppNavShell items={...}> 로 넘기는 호출부에서 구조적으로 검사된다.
type DashboardNavIcon = 'home' | 'book' | 'graduationCap' | 'report' | 'user' | 'users' | 'calendarDays';

const COMMON_TABS: Array<[string, DashboardNavKey]> = [
  ['/mypage', 'mypage'],
  ['/payment', 'mypage'],
];

/** 역할별 "경로 접두사 → 탭". 가장 긴 접두사가 이긴다. 선생님 반·학생 탭 재편은 2번 하위 프로젝트에서. */
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
    ['/tutor/lessons', 'classes'],
    ['/tutor/students', 'classes'],
    ['/tutor/class-groups', 'classes'],
    ['/tutor/reports', 'reports'],
    ['/reports', 'reports'],
    ['/tutor/join-organization', 'mypage'],
    ...COMMON_TABS,
  ],
  DIRECTOR: [
    ['/organization', 'home'],
    ['/organization/classes', 'classes'],
    ['/organization/tutors', 'tutors'],
    ['/organization/usage', 'usage'],
    ['/organization/reports', 'reports'],
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
 * AppNavShell에 넣을 항목들. 부모/선생님은 "서재" 탭을 갖고 선생님은 "수업" 탭이 하나 더 붙는다.
 * 좁은 화면에서 5탭이 되는 것은 TUTOR만이다. STAFF는 각 화면이 자체 항목을 구성한다.
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
    entries.push({ key: 'library', label: '서재', icon: 'book', path: '/tutor/library' });
    entries.push({ key: 'classes', label: '수업', icon: 'graduationCap', path: '/tutor/classes' });
  }
  if (user.role === 'DIRECTOR') {
    entries.push({ key: 'classes', label: '반·학생', icon: 'graduationCap', path: '/organization/classes' });
    entries.push({ key: 'tutors', label: '선생님', icon: 'users', path: '/organization/tutors' });
    entries.push({ key: 'usage', label: '이용 현황', icon: 'calendarDays', path: '/organization/usage' });
    entries.push({ key: 'reports', label: '리포트', icon: 'report', path: '/organization/reports' });
  }
  if (user.role === 'TUTOR') {
    entries.push({ key: 'reports', label: '리포트', icon: 'report', path: '/tutor/reports' });
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
