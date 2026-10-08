import { messageForError } from '@/shared/api';

/** 담임 초대 실패를 화면이 고를 수 있는 세 가지로 나눈다 - 없는 코드, 만료·사용된 코드, 그 밖(다시 시도). */
export type HomeroomInviteFailureKind = 'not-found' | 'expired' | 'other';

export function homeroomInviteFailureKind(failure: unknown): HomeroomInviteFailureKind {
  const { status, code } = (failure ?? {}) as { status?: number; code?: string };
  if (status === 410 || code === 'INVALID_INVITE') return 'expired';
  if (status === 404) return 'not-found';
  return 'other';
}

/**
 * 화면에 보일 실패 문장. 만료·사용(410)은 서버 safeDetail이 이유(새 코드로 바뀜·기한 지남·이미 사용)를 나눠 주므로
 * INVALID_INVITE 공통 문구보다 그 문장을 먼저 쓴다.
 */
export function homeroomInviteFailureMessage(failure: unknown, fallback: string): string {
  const detail = (failure as { message?: unknown } | null)?.message;
  if (homeroomInviteFailureKind(failure) === 'expired' && typeof detail === 'string' && detail.trim()) return detail.trim();
  return messageForError(failure, fallback);
}

/** 담임 초대 화면 주소. accept=1이면 로그인된 선생님에게 곧바로 수락한다(가입·로그인 뒤 돌아올 때). */
export function homeroomInvitePath(code: string, autoAccept = false): string {
  return `/homeroom-invite?code=${encodeURIComponent(code)}${autoAccept ? '&accept=1' : ''}`;
}

/**
 * 선생님이 직접 입력한 초대 코드가 담임 초대인지 기관 초대인지는 생김새로 구분되지 않는다 - 담임 초대로 먼저 물어보고,
 * 없는 코드(404)면 기관 초대 화면으로 넘긴다. 만료된 담임 코드는 담임 초대 화면이 안내하도록 그쪽으로 보낸다.
 */
export async function tutorInviteCodeDestination(
  code: string,
  preview: (code: string) => Promise<unknown>,
): Promise<string> {
  try {
    await preview(code);
    return homeroomInvitePath(code);
  } catch (failure) {
    if (homeroomInviteFailureKind(failure) === 'expired') return homeroomInvitePath(code);
    return `/org-invite/code/${encodeURIComponent(code)}`;
  }
}
