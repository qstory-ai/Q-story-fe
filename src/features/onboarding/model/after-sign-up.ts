type OnboardingRole = 'PARENT' | 'DIRECTOR' | 'TUTOR';

/**
 * 가입 직후(캐러셀 뒤) 갈 곳. 기관 초대 링크로 가입한 선생님은 소속 설정 온보딩을 건너뛰고 초대 수락
 * 화면으로 돌아간다 - 그 화면이 소속을 완성한다. 보호자의 next(반 연결)는 아이 등록 뒤에 쓴다.
 */
export function afterSignUpPath(role: OnboardingRole, signUpNext: string | undefined): string {
  if (role === 'TUTOR') return signUpNext ?? '/onboarding/tutor';
  if (role === 'PARENT') return '/onboarding/parent';
  return '/organization';
}
