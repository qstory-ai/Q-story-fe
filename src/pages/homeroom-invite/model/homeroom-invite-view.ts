import { homeroomInvitePath, type HomeroomInviteFailureKind } from '@/entities/homeroom-invite';

export type PreviewLoad<P> =
  | { status: 'loading' }
  | { status: 'ready'; preview: P }
  | { status: 'error'; kind: HomeroomInviteFailureKind; message: string };

export type ViewerAuth =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; role: string };

/**
 * 담임 초대 화면이 지금 보여 줄 것.
 *  - invalid: 코드가 없거나 없는 코드 / expired: 만료·사용된 코드 / error: 그 밖의 실패(다시 시도)
 *  - sign-in: 로그인 전(선생님 가입·로그인) / accept: 선생님 계정(수락 버튼) / wrong-role: 다른 역할 계정
 */
export type HomeroomInviteView = 'loading' | 'invalid' | 'expired' | 'error' | 'sign-in' | 'accept' | 'wrong-role';

export function selectHomeroomInviteView<P>(
  code: string,
  preview: PreviewLoad<P>,
  auth: ViewerAuth,
  acceptFailure?: HomeroomInviteFailureKind | null,
): HomeroomInviteView {
  if (!code) return 'invalid';
  // 수락하려다 만료·사용된 코드로 판명되면 미리보기가 성공했어도 만료 안내로 바꾼다.
  if (acceptFailure === 'expired') return 'expired';
  if (acceptFailure === 'not-found') return 'invalid';
  if (preview.status === 'loading' || auth.status === 'loading') return 'loading';
  if (preview.status === 'error') {
    return preview.kind === 'expired' ? 'expired' : preview.kind === 'not-found' ? 'invalid' : 'error';
  }
  if (auth.status === 'anonymous') return 'sign-in';
  return auth.role === 'TUTOR' ? 'accept' : 'wrong-role';
}

/** 가입·로그인 뒤 돌아왔을 때(accept=1) 한 번만 곧바로 수락한다. */
export function shouldAutoAccept(view: HomeroomInviteView, autoAccept: boolean, alreadyTried: boolean): boolean {
  return view === 'accept' && autoAccept && !alreadyTried;
}

/** 선생님 가입 - 약관 동의가 있는 기존 선생님 가입 화면을 쓰고, 끝나면 이 초대로 돌아와 곧바로 수락한다. */
export function tutorSignUpPath(code: string): string {
  return `/?flow=sign-up&role=tutor&next=${encodeURIComponent(homeroomInvitePath(code, true))}`;
}

export function tutorSignInPath(code: string): string {
  return `/?flow=sign-in&next=${encodeURIComponent(homeroomInvitePath(code, true))}`;
}
