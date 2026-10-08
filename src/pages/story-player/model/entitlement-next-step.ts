import type { AuthState } from '@/entities/auth';

/**
 * 이용권이 없어 막혔을 때(402) 다음 걸음 - 로그인 전이면 로그인, 보호자는 내 이용권, 원장은 기관 이용권(Q-33).
 * 선생님·직원은 직접 결제하지 않으므로 버튼 없이 서버 안내만 보여 준다.
 */
export function entitlementNextStep(auth: AuthState, currentPath: string): { label: string; path: string } | null {
  if (auth.status === 'anonymous') return { label: '로그인하기', path: `/login?next=${encodeURIComponent(currentPath)}` };
  if (auth.status !== 'authenticated') return null;
  if (auth.user.role === 'PARENT') return { label: '이용권 보기', path: '/mypage/subscription' };
  if (auth.user.role === 'DIRECTOR') return { label: '기관 이용권 보기', path: '/organization/subscription' };
  return null;
}
