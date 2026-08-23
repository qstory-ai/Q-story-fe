import type { UserSummary } from '../api/auth-api';

/**
 * Where a signed-in user belongs after login, and where "내 홈으로" on the home page sends them.
 * Shared so the two never disagree about a role's landing screen.
 */
export function homePathFor(user: UserSummary): string {
  switch (user.role) {
    case 'DIRECTOR':
      return '/director';
    case 'CLASS_ACCOUNT':
      return '/class';
    case 'PARENT':
      return '/parent';
    default:
      return '/';
  }
}
