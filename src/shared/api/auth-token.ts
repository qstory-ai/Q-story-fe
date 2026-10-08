/**
 * 이야기 관련 요청에 실을 로그인 토큰(Q-33). 서버는 이야기 내용·낭독·질문 처리·그레텔 대화 모두에서 이용권을 확인하므로,
 * 토큰이 빠지면 로그인한 사람도 익명으로 보고 이용권이 필요한 이야기를 402로 막는다.
 * AuthProvider가 로그인 상태가 바뀔 때 자식 화면의 요청보다 먼저(layout effect) 넣어 준다.
 */
let requestAuthToken: string | null = null;

export function setRequestAuthToken(token: string | null) {
  requestAuthToken = token;
}

export function currentRequestAuthToken(): string | null {
  return requestAuthToken;
}

/** fetch 헤더에 펼쳐 넣는다 - 로그인하지 않았으면 빈 객체. */
export function authorizationHeader(): Record<string, string> {
  return requestAuthToken ? { Authorization: `Bearer ${requestAuthToken}` } : {};
}
