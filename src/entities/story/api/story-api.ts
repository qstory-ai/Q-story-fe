import { apiBaseUrl } from '@/shared/config';
import { requestJson, type PublicRequestOptions } from '@/shared/api';

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
  /** 이 이야기가 entitlement로 제한되는지 - false면 (HG처럼) 누구나, 익명이라도 바로 볼 수 있다. */
  requiresEntitlement: boolean;
};

export type RequestOptions = PublicRequestOptions;

export class StoryApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return requestJson(StoryApiError, path, {}, { baseUrl: apiBaseUrl, ...options });
}

/** GET /v1/stories - 홈 라이브러리 그리드용으로, RETIRED가 아닌 모든 스토리의 카탈로그 메타데이터를 가져온다. */
export function listStories(options?: RequestOptions): Promise<StoryCatalogEntry[]> {
  return request('/v1/stories', options);
}

/** GET /v1/stories/{storyId} - 스토리 상세 페이지용으로, 단일 스토리의 카탈로그 메타데이터를 가져온다. */
export function fetchStoryEntry(storyId: string, options?: RequestOptions): Promise<StoryCatalogEntry> {
  return request(`/v1/stories/${storyId}`, options);
}
