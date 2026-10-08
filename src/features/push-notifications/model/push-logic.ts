/**
 * 푸시 알림의 순수 판단 로직 - 플러그인·네트워크 없이 테스트할 수 있게 따로 둔다(native-push.ts가 쓴다).
 */

/**
 * 푸시의 data.href를 앱 안 경로로만 받는다. "/"로 시작하는 경로만 허용하고, 다른 출처로 나가는
 * "//host"·"/\host"와 공백·제어 문자가 섞인 값은 버린다(서버가 보낸 값이라도 앱 밖으로 보내지 않는다).
 */
export function internalHrefOrNull(href: unknown): string | null {
  if (typeof href !== 'string') return null;
  if (!href.startsWith('/')) return null;
  if (href.startsWith('//') || href.startsWith('/\\')) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\s\u0000-\u001f\u007f]/.test(href)) return null;
  return href;
}

/** 마지막으로 서버에 등록한 (FCM 토큰, 계정) 짝. 로그아웃하면 null. */
export type SentToken = { token: string; userId: string } | null;

/**
 * 지금 토큰을 서버에 (다시) 보내야 하는지. 로그인돼 있고 토큰이 있으며, 마지막으로 보낸 짝과
 * 토큰이나 계정이 다를 때만 보낸다 - 토큰이 갱신됐거나 다른 계정으로 바뀐 경우.
 */
export function shouldSendToken(token: string | null, userId: string | null, lastSent: SentToken): boolean {
  if (!token || !userId) return false;
  return !lastSent || lastSent.token !== token || lastSent.userId !== userId;
}

export type PushPermissionState = 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied';

/**
 * 알림 권한 상태에 따라 다음 할 일. 허용돼 있으면 바로 등록, 아직 안 물었으면 한 번만 묻고,
 * 이미 물었는데 닫았거나 거부했으면 다시 묻지 않는다(설정에서 직접 켜야 한다).
 */
export function permissionStep(state: PushPermissionState, alreadyAsked: boolean): 'register' | 'request' | 'skip' {
  if (state === 'granted') return 'register';
  if (state === 'denied') return 'skip';
  return alreadyAsked ? 'skip' : 'request';
}
