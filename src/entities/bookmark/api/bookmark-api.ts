import { apiBaseUrl } from '@/shared/config';
import { requestJson, type PublicRequestOptions as RequestOptions } from '@/shared/api';

/**
 * IA "[2] 서재 > 저장한 작품"의 REST 클라이언트. 부모/선생님/반 계정 모두 같은 저장소를
 * 공유해서 소유자는 언제나 로그인한 계정 그 자체다 - 아이 프로필별로 나뉘지 않는다.
 */

export type Bookmark = {
  id: string;
  storyId: string;
  createdAt: string;
};

export class BookmarkApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

function request<T>(path: string, init: RequestInit, token: string, options: RequestOptions = {}): Promise<T> {
  return requestJson(BookmarkApiError, path, init, { baseUrl: apiBaseUrl, ...options, token });
}

export function listBookmarks(token: string, options?: RequestOptions): Promise<Bookmark[]> {
  return request('/v1/me/bookmarks', { method: 'GET' }, token, options);
}

export function createBookmark(token: string, storyId: string, options?: RequestOptions): Promise<Bookmark> {
  return request('/v1/me/bookmarks', { method: 'POST', body: JSON.stringify({ storyId }) }, token, options);
}

export function removeBookmark(token: string, storyId: string, options?: RequestOptions): Promise<void> {
  // 서버는 204를 반환한다 - requestJson()이 204를 자동으로 undefined로 처리한다.
  return request(`/v1/me/bookmarks/${encodeURIComponent(storyId)}`, { method: 'DELETE' }, token, options);
}
