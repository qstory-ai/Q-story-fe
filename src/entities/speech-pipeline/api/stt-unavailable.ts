/** 음성 인식 공급자가 결제/인증 문제로 막혔을 때 BE가 503 FailureBody로 돌려주는 코드. */
export const STT_UNAVAILABLE_CODE = 'STT_UNAVAILABLE';

/** 아이 화면에 그대로 보여주는 안내 - 글 질문으로 바로 넘어간다. */
export const STT_UNAVAILABLE_CHILD_COPY = '지금은 말로 질문하기가 어려워요. 글로 물어봐 줄래?';

export function isSttUnavailableCode(code: unknown): boolean {
  return code === STT_UNAVAILABLE_CODE;
}

/** {ok:false, failure:{code}} 봉투가 STT_UNAVAILABLE인지 판별한다. */
export function isSttUnavailableBody(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const failure = (body as { failure?: unknown }).failure;
  if (!failure || typeof failure !== 'object') return false;
  return isSttUnavailableCode((failure as { code?: unknown }).code);
}
