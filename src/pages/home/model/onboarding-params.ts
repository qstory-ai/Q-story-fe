export type OnboardingEntry = {
  step: 'welcome' | 'role' | 'sign-up' | 'sign-in';
  role?: 'PARENT' | 'DIRECTOR' | 'TUTOR';
  /** 반 초대 링크(/join?code=)에서 "계정 만들기"로 왔을 때 보호자 가입 폼에 미리 채울 반 코드. */
  classCode?: string;
  /** 로그인·가입 뒤 돌아갈 앱 내부 경로(반 초대 링크, 기관 초대 수락 등). */
  next?: string;
};

/** 로그인 뒤 돌아갈 경로는 앱 내부 경로만 받는다 - 외부 주소로 튕기는 오픈 리다이렉트를 막는다. */
export function safeNextPath(value: string | null): string | undefined {
  // "/\evil.com"은 브라우저가 "//evil.com"으로 읽고, 탭·줄바꿈은 지워진다 - 백슬래시와 공백 문자도 거절한다.
  return value && /^\/(?![/\\])[^\\\s]*$/.test(value) ? value : undefined;
}

/**
 * `?flow=sign-in|sign-up|welcome` + 선택적 `?role=parent|organization|tutor` (+ `classCode`, `next`)를
 * OnboardingEntry로 정규화한다. 역할 없이 가입으로 오면(튜토리얼의 "회원가입하기") 가입/로그인을 다시
 * 묻지 않고 역할 선택부터 보여 준다.
 */
export function readOnboardingParams(params: URLSearchParams): OnboardingEntry | null {
  const flow = params.get('flow');
  if (flow !== 'sign-in' && flow !== 'sign-up' && flow !== 'welcome') return null;
  const next = safeNextPath(params.get('next'));
  if (flow === 'sign-in') return { step: 'sign-in', next };
  if (flow === 'welcome') return { step: 'welcome' };
  const roleParam = params.get('role');
  const role: OnboardingEntry['role'] =
    roleParam === 'organization' ? 'DIRECTOR'
      : roleParam === 'tutor' ? 'TUTOR'
        : roleParam === 'parent' ? 'PARENT'
          : undefined;
  const classCode = params.get('classCode')?.trim().toUpperCase() || undefined;
  return role ? { step: 'sign-up', role, classCode, next } : { step: 'role', next };
}
