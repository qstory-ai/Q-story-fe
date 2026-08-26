import type { UserSummary } from '../api/auth-api';
import { homePathFor } from './home-path';

export type DashboardNavKey = 'home' | 'reports' | 'mypage';

// entities 레이어는 shared/ui 컴포넌트에 의존하지 않는다 - AppNavShellItem과 구조적으로
// 호환되는 형태(key/label/icon/active/onPress)만 여기서 만들고, 실제 컴포넌트 타입에 대한
// 할당 가능 여부는 이걸 <AppNavShell items={...}> 로 넘기는 호출부에서 구조적으로 검사된다.
type DashboardNavIcon = 'home' | 'report' | 'user';

/**
 * AppNavShell에 넣을 항목들 - "보고서"(/reports)는 PARENT/CLASS_ACCOUNT만 지원한다
 * (ReportHistoryPage.canView와 동일한 기준). 다른 역할(DIRECTOR/TUTOR/STAFF)은 아직
 * 그에 대응하는 통합 리포트 화면이 없어서, 그 역할용 화면에서는 이 헬퍼 대신 홈/마이페이지
 * 두 항목만 직접 구성해 쓴다.
 */
export function dashboardNavItems(
  user: UserSummary,
  navigate: (path: string) => void,
  active: DashboardNavKey,
): Array<{ key: DashboardNavKey; label: string; icon: DashboardNavIcon; active: boolean; onPress: () => void }> {
  const entries: Array<{ key: DashboardNavKey; label: string; icon: DashboardNavIcon; path: string }> = [
    { key: 'home', label: '홈', icon: 'home', path: homePathFor(user) },
  ];
  if (user.role === 'PARENT' || user.role === 'CLASS_ACCOUNT') {
    entries.push({ key: 'reports', label: '보고서', icon: 'report', path: '/reports' });
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
