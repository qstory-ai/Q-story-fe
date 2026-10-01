import type { UserSummary } from '../api/auth-api';
import type { AuthState } from './current-user';

/**
 * Where a signed-in user belongs after login, and where "내 홈으로" on the home page sends them.
 * Shared so the two never disagree about a role's landing screen.
 */
export function homePathFor(user: UserSummary): string {
  switch (user.role) {
    case 'DIRECTOR':
      return '/organization';
    case 'PARENT':
      return '/parent';
    case 'TUTOR':
      return '/tutor';
    case 'STAFF':
      return '/staff';
    default:
      return '/';
  }
}

/** "홈으로" 버튼의 목적지 - 로그인 상태면 역할 홈으로 바로 가서 "/" 경유 리다이렉트를 없앤다. */
export function homePathForAuth(state: AuthState): string {
  return state.status === 'authenticated' ? homePathFor(state.user) : '/';
}

export function libraryPathFor(user: UserSummary): string {
  if (user.role === 'PARENT') return '/library';
  if (user.role === 'TUTOR') return '/tutor/library';
  return homePathFor(user);
}

export function subscriptionPathFor(user: UserSummary): string {
  return user.role === 'DIRECTOR' ? '/organization/subscription' : '/mypage/subscription';
}
