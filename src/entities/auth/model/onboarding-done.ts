/**
 * 가입 직후 온보딩(부모: 아이 등록·동의, 선생님: 소속 설정)을 마쳤는지 기기에 기억한다. 마친 계정이 뒤로가기나
 * 주소 입력으로 온보딩 화면에 다시 들어오면 홈으로 보내, 아이 프로필이 중복으로 만들어지지 않게 한다.
 * localStorage를 못 쓰는 환경(프라이빗 모드 등)에서는 기억하지 못할 뿐 동작은 그대로다.
 */
type OnboardingRole = 'parent' | 'tutor';

function key(role: OnboardingRole, userId: string) {
  return `qstory.onboarding.${role}.done.${userId}`;
}

export function markOnboardingDone(role: OnboardingRole, userId: string) {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(key(role, userId), '1');
  } catch {
    // 저장하지 못해도 홈 진입은 그대로.
  }
}

export function hasCompletedOnboarding(role: OnboardingRole, userId: string): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(key(role, userId)) === '1';
  } catch {
    return false;
  }
}
