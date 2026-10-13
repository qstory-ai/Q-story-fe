/**
 * 가입 시 보내는 약관 동의 - BE 계약(`consents`)과 같은 필드명. 버전을 올리면 BE 기록에 그대로 남는다.
 * 2026-10-v2: 법정대리인(보호자) 확인(guardian)과 개인정보 국외 이전 동의(overseasTransfer)를 더했다(공개 전 확인사항 A5·A9).
 */
export const CONSENT_VERSION = '2026-10-v2';

export type ConsentPayload = {
  version: string;
  terms: boolean;
  privacy: boolean;
  marketing: boolean;
  /** 만 14세 미만 아이의 법정대리인(보호자) 확인 - 보호자 가입에 필수, 그 밖의 역할은 false. */
  guardian: boolean;
  /** 개인정보 국외 이전 동의 - 모든 가입에 필수. */
  overseasTransfer: boolean;
};

/** 서버가 아직 받지 않았다고 알려 주는 필수 동의(UserSummary.pendingConsents). */
export type PendingConsent = 'GUARDIAN' | 'OVERSEAS_TRANSFER' | 'ORG_GUARDIAN_ACK';

/** 약관 동의 화면 상태를 API 페이로드로 바꾼다. */
export function toConsentPayload(state: {
  service: boolean;
  privacy: boolean;
  marketing: boolean;
  guardian: boolean;
  overseas: boolean;
}): ConsentPayload {
  return {
    version: CONSENT_VERSION,
    terms: state.service,
    privacy: state.privacy,
    marketing: state.marketing,
    guardian: state.guardian,
    overseasTransfer: state.overseas,
  };
}

/** 다시 동의 화면을 띄울지 - STAFF(내부 계정)는 대상이 아니고, 예전 서버처럼 값이 없으면 띄우지 않는다. */
export function pendingConsentsOf(user: { role: string; pendingConsents?: readonly string[] | null }): PendingConsent[] {
  if (user.role === 'STAFF' || !Array.isArray(user.pendingConsents)) return [];
  return user.pendingConsents.filter(
    (item): item is PendingConsent => item === 'GUARDIAN' || item === 'OVERSEAS_TRANSFER' || item === 'ORG_GUARDIAN_ACK',
  );
}
