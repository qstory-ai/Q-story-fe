/** 가입 시 보내는 약관 동의 - BE 계약(`consents`)과 같은 필드명. */
export const CONSENT_VERSION = '2026-10-v1';

export type ConsentPayload = {
  version: string;
  terms: boolean;
  privacy: boolean;
  marketing: boolean;
};

/** 약관 동의 화면 상태(service/privacy/marketing)를 API 페이로드로 바꾼다. */
export function toConsentPayload(state: { service: boolean; privacy: boolean; marketing: boolean }): ConsentPayload {
  return {
    version: CONSENT_VERSION,
    terms: state.service,
    privacy: state.privacy,
    marketing: state.marketing,
  };
}
