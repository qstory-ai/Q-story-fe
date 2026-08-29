import { apiBaseUrl } from '@/shared/config';
import { requestJson, type PublicRequestOptions as RequestOptions } from '@/shared/api';

export type SceneView = {
  id: string;
  title: string;
  sequence: number;
  checkpointId: string;
};

export type SegmentView = {
  id: string;
  sceneId: string;
  displayOrder: number;
  kind: string;
  branchPoint: boolean;
  narrationStale: boolean;
  payload: Record<string, unknown>;
};

export type RevisionView = {
  revision: number;
  targetType: string;
  targetId: string;
  operation: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  authorId: string | null;
  summary: string | null;
  createdAt: string;
};

export type StaleLine = {
  segmentId: string;
  sceneId: string;
  spoken: string | null;
  written: string | null;
};

export type ScenesResponse = { revision: number; scenes: SceneView[] };
export type SegmentsResponse = { revision: number; segments: SegmentView[] };

export class StoryAdminApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

function request<T>(path: string, init: RequestInit, token: string, options: RequestOptions = {}): Promise<T> {
  return requestJson(StoryAdminApiError, path, init, { baseUrl: apiBaseUrl, ...options, token });
}

export function listScenes(token: string, storyId: string, options?: RequestOptions): Promise<ScenesResponse> {
  return request(`/v1/admin/stories/${storyId}/scenes`, { method: 'GET' }, token, options);
}

export function editScene(
  token: string,
  storyId: string,
  sceneId: string,
  input: { baseRevision: number; title?: string; sequence?: number; summary?: string },
  options?: RequestOptions,
): Promise<SceneView> {
  return request(
    `/v1/admin/stories/${storyId}/scenes/${sceneId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
    token,
    options,
  );
}

export function listSegments(
  token: string,
  storyId: string,
  sceneId: string,
  options?: RequestOptions,
): Promise<SegmentsResponse> {
  return request(`/v1/admin/stories/${storyId}/scenes/${sceneId}/segments`, { method: 'GET' }, token, options);
}

export function editSegment(
  token: string,
  storyId: string,
  segmentId: string,
  input: { baseRevision: number; payload: Record<string, unknown>; summary?: string },
  options?: RequestOptions,
): Promise<SegmentView> {
  return request(
    `/v1/admin/stories/${storyId}/segments/${segmentId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
    token,
    options,
  );
}

export function listRevisions(token: string, storyId: string, options?: RequestOptions): Promise<RevisionView[]> {
  return request(`/v1/admin/stories/${storyId}/revisions`, { method: 'GET' }, token, options);
}

export function revertRevision(
  token: string,
  storyId: string,
  input: { baseRevision: number; revision: number; summary?: string },
  options?: RequestOptions,
): Promise<Record<string, unknown>> {
  return request(
    `/v1/admin/stories/${storyId}/revisions/revert`,
    { method: 'POST', body: JSON.stringify(input) },
    token,
    options,
  );
}

export function listStaleNarration(token: string, storyId: string, options?: RequestOptions): Promise<StaleLine[]> {
  return request(`/v1/admin/stories/${storyId}/narration/stale`, { method: 'GET' }, token, options);
}

export function rerenderNarration(
  token: string,
  storyId: string,
  segmentId: string,
  options?: RequestOptions,
): Promise<Record<string, unknown>> {
  return request(
    `/v1/admin/stories/${storyId}/segments/${segmentId}/narration/rerender`,
    { method: 'POST' },
    token,
    options,
  );
}
