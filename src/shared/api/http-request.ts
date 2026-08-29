/**
 * 백엔드 실패 응답 형태는 {ok:false, failure:{code, safeDetail}}로 고정되어 있고, safeDetail은
 * 사용자에게 그대로 보여주도록 쓰여진 문자열이다 - 폼 에러 메시지가 이를 그대로 노출한다.
 * auth-api.ts / story-api.ts 등 여러 entity api 모듈이 거의 동일한 request<T>()를 각자
 * 복제해 두고 있던 것을 여기로 모았다. 도메인마다 다른 XxxApiError 클래스는 그대로 유지되고
 * (인스턴스 타입 검사를 쓰는 호출부가 많다), 이 헬퍼는 그 클래스의 생성자만 넘겨받는다.
 */
export type ApiErrorConstructor<E extends Error> = new (
  message: string,
  code?: string,
  status?: number,
) => E;

export type RequestOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  token?: string | null;
  /** 성공 응답 본문을 JSON으로 파싱할지 - 항상 빈 본문만 오는 submit형 엔드포인트는 false로 넘긴다. 기본값 true. */
  parseResponse?: boolean;
};

/**
 * token/parseResponse는 각 entity api 모듈이 자기 request()의 다른 인자(token) 또는
 * 고정값(parseResponse)으로 직접 채우므로, 공개 함수 시그니처에는 이 둘을 뺀 형태를 쓴다.
 * 여러 모듈이 각자 `Omit<RequestOptions, 'token' | 'parseResponse'>`를 반복 선언하던 것을 모았다.
 */
export type PublicRequestOptions = Omit<RequestOptions, 'token' | 'parseResponse'>;

export async function requestJson<T, E extends Error>(
  ErrorCtor: ApiErrorConstructor<E>,
  path: string,
  init: RequestInit,
  { baseUrl, fetchImpl = fetch, token, parseResponse = true }: RequestOptions = {},
): Promise<T> {
  if (!baseUrl) {
    throw new ErrorCtor('VITE_QSTORY_API_URL is not configured.');
  }
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetchImpl.call(globalThis, `${baseUrl}${path}`, { ...init, headers });
  if (!response.ok) {
    let code: string | undefined;
    let safeDetail: string | undefined;
    try {
      const body = (await response.json()) as { failure?: { code?: string; safeDetail?: string } };
      code = body.failure?.code;
      safeDetail = body.failure?.safeDetail;
    } catch {
      // 실패 응답 본문을 읽지 못하면 아래 기본 메시지로 대체한다.
    }
    throw new ErrorCtor(safeDetail ?? `요청을 처리하지 못했어요. (HTTP ${response.status})`, code, response.status);
  }
  if (!parseResponse || response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
