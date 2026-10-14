/** 로그인 뒤 돌아갈 경로는 앱 내부 경로만 받는다 - 외부 주소로 튕기는 오픈 리다이렉트를 막는다. */
export function safeNextPath(value: string | null): string | undefined {
  // "/\evil.com"은 브라우저가 "//evil.com"으로 읽고, 탭·줄바꿈은 지워진다 - 백슬래시와 공백 문자도 거절한다.
  return value && /^\/(?![/\\])[^\\\s]*$/.test(value) ? value : undefined;
}
