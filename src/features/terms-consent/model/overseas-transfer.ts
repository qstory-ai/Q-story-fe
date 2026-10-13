/**
 * 개인정보 국외 이전 고지(개인정보 처리방침 제5조, 공개 전 확인사항 A9). 문구를 바꾸면 legal/03-개인정보-처리방침.md 제5조와
 * 약관 버전(entities/auth CONSENT_VERSION)도 함께 맞춘다.
 *
 * 리전 근거(2026-10-12 확인): Supabase DB는 ap-northeast-2(서울), 서버(Railway)는 유럽 서부(암스테르담) 복제본,
 * 서버 기록(Grafana Cloud Loki)은 AWS 도쿄(ap-northeast-1), 웹 프록시(Vercel)는 icn1(서울).
 */
export type OverseasTransferRecipient = {
  recipient: string;
  country: string;
  items: string;
  purpose: string;
  retention: string;
};

export const OVERSEAS_TRANSFER_LABEL = '[필수] 개인정보 국외 이전 동의';

export const OVERSEAS_TRANSFER_SUMMARY =
  '질문에 답하고 캐릭터 목소리를 만드는 AI 업체 등 해외 업체로 서비스 이용 중 정보가 전송돼요.';

export const OVERSEAS_TRANSFER_RECIPIENTS: readonly OverseasTransferRecipient[] = [
  {
    recipient: 'OpenRouter, Inc.',
    country: '미국',
    items: '질문 문장, 이야기 맥락',
    purpose: 'AI 응답 생성',
    retention: '응답을 만든 뒤 업체 정책에 따라 삭제',
  },
  {
    recipient: 'Google LLC (Gemini)',
    country: '미국',
    items: '낭독 문장(아이 이름이 들어갈 수 있음), 질문 문장',
    purpose: '캐릭터 음성 합성, AI 응답 생성',
    retention: '처리한 뒤 업체 정책에 따라 삭제',
  },
  {
    recipient: 'Google LLC (Firebase 푸시 알림)',
    country: '미국',
    items: '기기 알림 토큰, 알림 내용',
    purpose: '앱 푸시 알림 보내기',
    retention: '알림을 보낸 뒤 업체 정책에 따라 삭제, 기기 토큰은 로그아웃·탈퇴 때까지',
  },
  {
    recipient: 'Railway Corp.',
    country: '네덜란드',
    items: '서비스 이용 중 주고받는 정보(질문 문장·대화 기록 포함), 서버 기록',
    purpose: '서버 운영(처리만 하고 저장은 국내 데이터베이스에 해요)',
    retention: '서버 기록은 업체 보관 기간 동안',
  },
  {
    recipient: 'Grafana Labs',
    country: '일본',
    items: '서버 기록(요청·오류 기록)',
    purpose: '서버 기록 보관·분석',
    retention: '서버 기록은 보관 설정 기간 동안',
  },
];

export const OVERSEAS_TRANSFER_TIMING = '서비스를 이용할 때마다 암호화된 네트워크(HTTPS)로 전송해요.';

export const OVERSEAS_TRANSFER_DOMESTIC_NOTE =
  '국내에서 처리해 국외 이전이 아닌 업체: Supabase(데이터 보관, 서울 리전), (주)리턴제로(음성 인식), (주)토스페이먼츠(결제).';

export const OVERSEAS_TRANSFER_REFUSAL =
  '동의하지 않을 수 있어요. 다만 질문 응답·음성 낭독 같은 핵심 기능에 꼭 필요해서, 동의하지 않으면 서비스를 이용할 수 없어요.';

/** 보호자 가입의 필수 항목 - 만 14세 미만 아이 정보는 법정대리인 동의로 처리한다(개인정보 처리방침 제8조 2항). */
export const GUARDIAN_CONSENT_LABEL = '[필수] 만 14세 미만 아이의 법정대리인(보호자)으로서 아이 정보 처리에 동의해요';

/** 기관 등록의 필수 확인 - 기관 단위로 남긴다(BE Organization.guardianConsentAck*). */
export const ORG_GUARDIAN_ACK_LABEL = '[필수] 원아의 보호자 동의를 받아 이용해요';
export const ORG_GUARDIAN_ACK_DESCRIPTION =
  '기관이 원아 보호자에게 Q-Story 이용과 아이 정보 처리를 안내하고 동의를 받아요. 선생님이 반 명단에 아이를 올릴 때도 이 동의를 전제로 해요.';
