import type { UserSummary } from '../api/auth-api';
import { tokenOwner, tokenRemembersLogin, type StorageLike, type Storages } from './session';

const USER_STORAGE_KEY = 'qstory.auth.user.v1';

/**
 * 앱을 다시 열 때 `/v1/auth/me` 응답을 기다리지 않고 바로 화면을 그리려고 저장해 두는 사용자 요약이다.
 * 화면 분기(역할·기관·이용권·다시 동의)에 필요한 값과 이름만 담고, 연락처·로그인 아이디·아이 이름·사진 주소 같은
 * 개인정보는 담지 않는다 - 그 값들은 뒤에서 받은 `/v1/auth/me` 응답으로 곧 채워진다.
 */
type CachedUser = Pick<
  UserSummary,
  'id' | 'role' | 'displayName' | 'organizationId' | 'subscriptionStatus' | 'grantsAccess' | 'pendingConsents'
>;

function safely<T>(run: () => T, fallback: T): T {
  try {
    return run();
  } catch {
    return fallback;
  }
}

function parse(raw: string | null): CachedUser | null {
  if (!raw) return null;
  const value = safely<unknown>(() => JSON.parse(raw), null);
  if (!value || typeof value !== 'object') return null;
  const user = value as Record<string, unknown>;
  if (typeof user.id !== 'string' || typeof user.role !== 'string' || typeof user.displayName !== 'string') return null;
  if (typeof user.grantsAccess !== 'boolean' || typeof user.subscriptionStatus !== 'string') return null;
  return {
    id: user.id,
    role: user.role as UserSummary['role'],
    displayName: user.displayName,
    organizationId: typeof user.organizationId === 'string' ? user.organizationId : null,
    subscriptionStatus: user.subscriptionStatus as UserSummary['subscriptionStatus'],
    grantsAccess: user.grantsAccess,
    pendingConsents: Array.isArray(user.pendingConsents)
      ? user.pendingConsents.filter((item): item is string => typeof item === 'string')
      : undefined,
  };
}

/**
 * 토큰과 같은 저장소(로그인 유지면 localStorage, 아니면 sessionStorage)에 둬서 토큰과 수명이 같다. 읽을 때는 토큰의
 * sub·role과 맞는 경우에만 돌려준다 - 다른 계정의 요약이 남아 있어도 그 화면을 그리지 않는다.
 */
export function createUserCache(storages: Storages) {
  const both = (): Array<StorageLike | undefined> => [
    safely(() => storages.session(), undefined),
    safely(() => storages.local(), undefined),
  ];
  return {
    read(token: string): UserSummary | null {
      const owner = tokenOwner(token);
      if (!owner) return null;
      for (const storage of both()) {
        const cached = parse(safely(() => storage?.getItem(USER_STORAGE_KEY) ?? null, null));
        if (cached && cached.id === owner.userId && cached.role === owner.role) {
          return {
            ...cached,
            loginId: '',
            email: null,
            childName: null,
            profileImageUrl: null,
            subscriptionExpiresAt: null,
          };
        }
      }
      return null;
    },
    write(token: string, user: UserSummary): void {
      const cached: CachedUser = {
        id: user.id,
        role: user.role,
        displayName: user.displayName,
        organizationId: user.organizationId,
        subscriptionStatus: user.subscriptionStatus,
        grantsAccess: user.grantsAccess,
        pendingConsents: user.pendingConsents,
      };
      const [target, other] = tokenRemembersLogin(token)
        ? [storages.local, storages.session]
        : [storages.session, storages.local];
      safely(() => other()?.removeItem(USER_STORAGE_KEY), undefined);
      safely(() => target()?.setItem(USER_STORAGE_KEY, JSON.stringify(cached)), undefined);
    },
    clear(): void {
      for (const storage of both()) safely(() => storage?.removeItem(USER_STORAGE_KEY), undefined);
    },
  };
}

const browserUserCache = createUserCache({
  local: () => globalThis.localStorage,
  session: () => globalThis.sessionStorage,
});

export function readCachedUser(token: string): UserSummary | null {
  return browserUserCache.read(token);
}

export function storeCachedUser(token: string, user: UserSummary): void {
  browserUserCache.write(token, user);
}

export function clearCachedUser(): void {
  browserUserCache.clear();
}
