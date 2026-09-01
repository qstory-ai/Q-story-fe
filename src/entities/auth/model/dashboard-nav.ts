import type { UserSummary } from '../api/auth-api';
import { homePathFor } from './home-path';

export type DashboardNavKey = 'home' | 'library' | 'classes' | 'reports' | 'mypage';

// entities 레이어는 shared/ui 컴포넌트에 의존하지 않는다 - AppNavShellItem과 구조적으로
// 호환되는 형태(key/label/icon/active/onPress)만 여기서 만들고, 실제 컴포넌트 타입에 대한
// 할당 가능 여부는 이걸 <AppNavShell items={...}> 로 넘기는 호출부에서 구조적으로 검사된다.
type DashboardNavIcon = 'home' | 'book' | 'graduationCap' | 'report' | 'user';

/**
 * AppNavShell에 넣을 항목들. IA의 하단 탭 요구를 반영해 부모/선생님 모두 "서재" 탭을 갖고,
 * 선생님은 여기에 "수업" 탭이 하나 더 붙는다. "리포트"는 PARENT/CLASS_ACCOUNT만 지원한다
 * (ReportHistoryPage.canView와 같은 기준). DIRECTOR/STAFF 같은 통합 리포트가 아직 없는
 * 역할은 이 헬퍼가 아닌 각 역할 화면이 자체 항목을 구성한다.
 *
 * 좁은 화면에서 5탭이 되는 것은 TUTOR만이라 IA에서 요구한 최대치. 하단바 아이템은 flex:1
 * 이라 자동으로 균등 분할되고, 라벨 폰트는 xxs라 400px 근처에서도 잘리지 않는다(확인은
 * QA 체크리스트로 남긴다).
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
    entries.push({ key: 'library', label: '서재', icon: 'book', path: '/library' });
  }
  if (user.role === 'TUTOR') {
    entries.push({ key: 'library', label: '서재', icon: 'book', path: '/tutor/library' });
    entries.push({ key: 'classes', label: '수업', icon: 'graduationCap', path: '/tutor/classes' });
  }
  if (user.role === 'PARENT' || user.role === 'CLASS_ACCOUNT') {
    entries.push({ key: 'reports', label: '리포트', icon: 'report', path: '/reports' });
  }
  if (user.role === 'TUTOR') {
    // 선생님용 리포트 탭 - 자기 학생 세션 완주 기록을 학생별로 묶어 본다.
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
