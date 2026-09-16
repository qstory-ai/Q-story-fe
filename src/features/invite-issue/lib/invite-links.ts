import { webOrigin } from '@/shared/config';

/**
 * 초대 코드·링크 카드 세 곳(학생 등록 마법사, 학생 목록, 학생 상세)과 기관 초대 두 곳이 각자
 * 하드코딩하던 링크 조립·공유 문구·만료 표기. 링크의 출처는 window.location.origin이 아니라
 * webOrigin()이다 - 태블릿 앱(Capacitor)에서는 페이지 출처가 실제 웹 주소가 아니라서, 거기서 만든
 * 링크를 부모가 열면 존재하지 않는 호스트로 갔다.
 */
export function tutorInviteLink(token: string) {
  return `${webOrigin()}/tutor-invite/${token}`;
}

export function organizationTutorInviteLink(token: string) {
  return `${webOrigin()}/org-invite/${token}`;
}

export function classInviteLink(token: string) {
  return `${webOrigin()}/signup?invite=${token}`;
}

export function tutorInviteShareMessage(studentName: string) {
  return `${studentName} 부모님, Q-Story 수업 연결 초대예요. 아래 코드나 링크로 들어와 주세요.`;
}

// Intl.DateTimeFormat 생성은 로케일 데이터를 읽는 비싼 작업이라 모듈 수준에서 한 번만 만든다.
const INVITE_EXPIRY_FORMAT = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric' });

/** 초대 만료 시각 표기 - "9월 20일 오후 4시". 잘못된 ISO 문자열이면 undefined(카드가 만료 줄을 생략). */
export function formatInviteExpiry(iso: string): string | undefined {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : INVITE_EXPIRY_FORMAT.format(date);
}
