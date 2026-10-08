/**
 * 이야기 요청에 실을 로그인 토큰. 이용권이 필요한 이야기는 서버가 토큰으로 기관 이용권을 확인하므로,
 * 토큰이 빠지면 로그인한 선생님도 익명으로 보고 402로 막는다(Q-33). AuthProvider가 로그인 상태가 바뀔 때마다 넣어 준다.
 */
let storyAuthToken: string | null = null;

export function setStoryAuthToken(token: string | null) {
  storyAuthToken = token;
}

export function currentStoryAuthToken(): string | null {
  return storyAuthToken;
}
