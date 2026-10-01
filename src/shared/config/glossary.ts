/**
 * 화면 문구의 단일 기준(UX 정리 0번 스펙 §1). 새 문구는 여기 단어를 쓰고, BANNED_UI_TERMS는
 * glossary.test.ts가 소스 전체에서 재발을 막는다.
 */
export const GLOSSARY = {
  classGroup: '반',
  lesson: '수업',
  guardian: '보호자',
  pendingGuardian: '보호자 연결 대기',
  entitlement: '이용권',
  report: '리포트',
  organization: '기관',
  director: '관리자',
} as const;

type SubscriptionStatus = 'NONE' | 'TRIALING' | 'ACTIVE' | 'EXPIRED';

const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  NONE: '이용권 없음',
  TRIALING: '체험 중',
  ACTIVE: '이용 중',
  EXPIRED: '만료됨',
};

export function subscriptionStatusLabel(status: SubscriptionStatus): string {
  return SUBSCRIPTION_STATUS_LABEL[status];
}

/** 선생님·관리자에게 보이는 이용권 안내 - BE qstory.beta.open-access-tutor-org와 짝. */
export const BETA_OPEN_ACCESS_NOTICE = '베타 기간에는 모든 이야기가 열려 있어요.';

export const BANNED_UI_TERMS = [
  '학부모',
  '부모 리포트',
  '구독',
  '원장',
  '기관 관리자',
  '라이선스',
  '비즈니스 이용권',
  '완주 기록',
  '부모 확인 대기',
  '부모 연결 대기',
  '연결 안 됨',
  '기관 및 단체',
] as const;
