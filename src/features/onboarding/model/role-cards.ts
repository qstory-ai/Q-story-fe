export type OnboardingRole = 'PARENT' | 'DIRECTOR' | 'TUTOR';

/**
 * 역할 카드의 순서와 문구 - "/" 비로그인 패널과 온보딩 역할 선택이 같은 것을 쓴다.
 * IA의 회원 유형 분류에 맞춰 기관 소속 여부와 무관하게 모두 "선생님"으로 표기하고, 실제 소속은 온보딩 이후에 정한다.
 */
export const ROLE_CARDS: ReadonlyArray<{ role: OnboardingRole; title: string; description: string }> = [
  { role: 'PARENT', title: '보호자', description: '아이와 함께 이야기 서재를 쓰고, 리포트를 받아요.' },
  {
    role: 'TUTOR',
    title: '선생님',
    description: '반을 만들어 수업을 준비하고 보호자께 리포트를 전달해요. 1:1 과외도 아이 한 명짜리 반으로 시작해요. 기관 소속·독립 활동 모두 가능해요.',
  },
  { role: 'DIRECTOR', title: '기관', description: '유치원·학원에서 반을 만들고 여러 아이가 함께 듣는 수업을 준비해요.' },
];
