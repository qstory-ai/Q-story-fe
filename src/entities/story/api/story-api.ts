import { readEnv } from '@/shared/config';

const apiBaseUrl = readEnv('VITE_QSTORY_API_URL');

export type StoryCatalogEntry = {
  storyId: string;
  slug: string;
  title: string;
  availability: string;
  contentVersion: string;
  castVersion: string;
  coverImageUrl: string | null;
  description: string | null;
  category: string | null;
};

type RequestOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

/**
 * shared/api로 뽑아내는 대신 auth-api.ts의 request<T>()를 이 파일 안에 작게 복제한 것 - 이
 * 코드베이스는 호출자가 하나뿐인 것을 위한 공유 추상화보다, 도메인당 작은 파일 하나를 두는
 * 방식을 선호한다.
 */
export class StoryApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  { baseUrl = apiBaseUrl, fetchImpl = fetch }: RequestOptions = {},
): Promise<T> {
  if (!baseUrl) {
    throw new StoryApiError('VITE_QSTORY_API_URL is not configured.');
  }
  const response = await fetchImpl.call(globalThis, `${baseUrl}${path}`);
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
    throw new StoryApiError(safeDetail ?? `요청을 처리하지 못했어요. (HTTP ${response.status})`, code, response.status);
  }
  return (await response.json()) as T;
}

/** GET /v1/stories - 홈 라이브러리 그리드용으로, RETIRED가 아닌 모든 스토리의 카탈로그 메타데이터를 가져온다. */
export function listStories(options?: RequestOptions): Promise<StoryCatalogEntry[]> {
  return request('/v1/stories', options);
}

/** GET /v1/stories/{storyId} - 스토리 상세 페이지용으로, 단일 스토리의 카탈로그 메타데이터를 가져온다. */
export function fetchStoryEntry(storyId: string, options?: RequestOptions): Promise<StoryCatalogEntry> {
  return request(`/v1/stories/${storyId}`, options);
}
