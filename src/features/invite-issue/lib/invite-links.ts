import { webOrigin } from '@/shared/config';

/**
 * 초대 링크 조립·공유 문구·만료 표기. 링크의 출처는 window.location.origin이 아니라 webOrigin()이다 -
 * 태블릿 앱(Capacitor)에서는 페이지 출처가 실제 웹 주소가 아니라서, 거기서 만든 링크를 부모가 열면
 * 존재하지 않는 호스트로 갔다.
 */
export function organizationTutorInviteLink(token: string) {
  return `${webOrigin()}/org-invite/${token}`;
}

/** 반 초대 링크 하나 - 알림장·단체방에 그대로 올리면 부모님마다 자기 아이를 골라 반에 들어온다. */
export function classInviteLink(joinCode: string) {
  return `${webOrigin()}/join?code=${encodeURIComponent(joinCode)}`;
}

export function classInviteShareMessage(className: string, organizationName?: string | null) {
  const where = organizationName ? `${organizationName} ${className}` : className;
  return `${where} 부모님, Q-Story 반 초대예요. 아래 링크로 들어와 아이 이름을 확인해 주시면 반 수업 리포트를 받아 보실 수 있어요.`;
}

// Intl.DateTimeFormat 생성은 로케일 데이터를 읽는 비싼 작업이라 모듈 수준에서 한 번만 만든다.
const INVITE_EXPIRY_FORMAT = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric' });

/** 초대 만료 시각 표기 - "9월 20일 오후 4시". 잘못된 ISO 문자열이면 undefined(카드가 만료 줄을 생략). */
export function formatInviteExpiry(iso: string): string | undefined {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : INVITE_EXPIRY_FORMAT.format(date);
}
