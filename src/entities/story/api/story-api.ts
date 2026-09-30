import { apiBaseUrl } from '@/shared/config';
import { requestJson, type PublicRequestOptions } from '@/shared/api';

import type { StoryReportCopy } from '../model/story-package-types';

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

export class StoryApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

function request<T>(path: string, options: PublicRequestOptions = {}): Promise<T> {
  return requestJson(StoryApiError, path, {}, { baseUrl: apiBaseUrl, ...options });
}

/** GET /v1/stories - 홈 라이브러리 그리드용으로, RETIRED가 아닌 모든 스토리의 카탈로그 메타데이터를 가져온다. */
export function listStories(options?: PublicRequestOptions): Promise<StoryCatalogEntry[]> {
  return request('/v1/stories', options);
}

/**
 * GET /v1/stories/{storyId}/report-copy - 이야기의 리포트 문구 팩(report-copy.yaml)만 가져온다.
 * 여러 이야기의 기록을 모아 보는 종합 리포트가 이야기별 전략 표(strategyByFamily)를 쓰려고 부른다 -
 * 전체 콘텐츠(/content)를 이야기마다 받지 않도록 따로 둔 가벼운 경로다.
 */
export function fetchStoryReportCopy(storyId: string, options?: PublicRequestOptions): Promise<StoryReportCopy> {
  return request(`/v1/stories/${storyId}/report-copy`, options);
}

/** GET /v1/stories/{storyId} - 스토리 상세 페이지용으로, 단일 스토리의 카탈로그 메타데이터를 가져온다. */
export function fetchStoryEntry(storyId: string, options?: PublicRequestOptions): Promise<StoryCatalogEntry> {
  return request(`/v1/stories/${storyId}`, options);
}
