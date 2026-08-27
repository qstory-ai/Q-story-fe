import { speechApiUrl } from '@/entities/speech-pipeline';

import { buildStoryRuntimePackage, type StoryRuntimePackage } from './story-package';
import type { GeneratedStoryContent, StoryPackageData } from './story-package-types';
import {
  STORY_AUDIO_ASSETS_BY_ID,
  STORY_IMAGE_ASSETS_BY_ID,
} from './story-assets.generated';

export const DEFAULT_BETA_STORY_ID = 'HG';

/**
 * The backend's failure envelope is {ok:false, failure:{code, stage, retryable, safeDetail}} - the
 * same shape auth-api.ts's AuthApiError surfaces. safeDetail is written for a child to read, so the
 * load screen shows it as-is instead of guessing "check your connection", which hides the real
 * cause (e.g. STORY_NOT_REGISTERED when the story was never imported into the backend's DB).
 */
export class StoryLoadError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = 'StoryLoadError';
  }
}

export type StoryLoadFailure = {
  message: string;
  code?: string;
  retryable: boolean;
};

/**
 * Maps anything loadStoryPackage() can reject with onto the copy the load screen shows. A thrown
 * fetch (offline, DNS, CORS) never reaches the backend and carries no envelope - that, and only
 * that, is the case where "check your connection" is the honest message.
 */
export function describeStoryLoadFailure(error: unknown): StoryLoadFailure {
  if (error instanceof StoryLoadError) {
    return { message: error.message, code: error.code, retryable: error.retryable };
  }
  return { message: '인터넷 연결을 확인한 뒤 다시 시도해 주세요.', retryable: true };
}

type LoadStoryPackageOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

const packageCache = new Map<string, Promise<StoryRuntimePackage>>();

/**
 * Fetches a story's full narrative content from the backend (GET /v1/stories/{storyId}/content -
 * see StoryContentAssemblyService) and compiles it with the same buildStoryRuntimePackage() the
 * build pipeline used to run at build time. Cached per storyId for the lifetime of the session -
 * a child mid-story should never see content change under them.
 */
export function loadStoryPackage(
  storyId: string,
  options: LoadStoryPackageOptions = {},
): Promise<StoryRuntimePackage> {
  const cached = packageCache.get(storyId);
  if (cached) {
    return cached;
  }
  const promise = fetchStoryPackage(storyId, options).catch((error: unknown) => {
    // A failed load isn't cached - the next call (e.g. a retry button) gets a fresh attempt.
    packageCache.delete(storyId);
    throw error;
  });
  packageCache.set(storyId, promise);
  return promise;
}

/**
 * Forces a fresh GET /v1/stories/{storyId}/content fetch, bypassing loadStoryPackage()'s cache, and
 * replaces the cached entry with the new result. Used after a live-branch generation job reports
 * READY (see use-one-story-runtime.ts's polling effect): the newly-committed family/segment/asset
 * only exists once this refetch runs, since there is no incremental-fetch endpoint. Goes through the
 * exact same fetchStoryPackage()/buildStoryRuntimePackage() parsing path as the initial load, so the
 * new content is compiled identically to build-time-authored content.
 */
export function refetchStoryPackage(
  storyId: string,
  options: LoadStoryPackageOptions = {},
): Promise<StoryRuntimePackage> {
  const promise = fetchStoryPackage(storyId, options);
  packageCache.set(storyId, promise);
  return promise;
}

async function fetchStoryPackage(
  storyId: string,
  { baseUrl = speechApiUrl, fetchImpl = fetch }: LoadStoryPackageOptions,
): Promise<StoryRuntimePackage> {
  if (!baseUrl) {
    throw new StoryLoadError(
      '이야기 서버 주소가 설정되지 않았어요. (VITE_QSTORY_API_URL)',
      'API_URL_NOT_CONFIGURED',
    );
  }
  const response = await fetchImpl.call(globalThis, `${baseUrl}/v1/stories/${storyId}/content`);
  if (!response.ok) {
    throw await storyLoadErrorFrom(response);
  }
  const body = (await response.json()) as {
    generatedContent: GeneratedStoryContent;
    packageData: StoryPackageData;
  };
  // Assets come with the content. They used to come from a map baked into this bundle at build
  // time, which meant a re-recorded line or a swapped illustration could not reach a child without
  // shipping a new frontend - the build-time maps are kept only as the offline fallback below.
  const contentStoryId = body.packageData.story.storyId;
  const served = body.packageData.assets;
  const imageAssets = served
    ? Object.fromEntries(
        served
          .filter((asset) => asset.category === 'SCENE_ART' || asset.category === 'BRANCH_ART')
          .map((asset) => [asset.slug, { uri: asset.url }]),
      )
    : STORY_IMAGE_ASSETS_BY_ID[contentStoryId] ?? {};
  const audioAssets = served
    ? Object.fromEntries(
        served
          .filter((asset) => asset.category === 'NARRATION' || asset.category === 'BRIDGE')
          .map((asset) => [asset.slug, { uri: asset.url }]),
      )
    : STORY_AUDIO_ASSETS_BY_ID[contentStoryId] ?? {};
  return buildStoryRuntimePackage({
    generatedContent: body.generatedContent,
    packageData: body.packageData,
    imageAssets,
    audioAssets,
  });
}

export async function getDefaultBetaStory(
  options: LoadStoryPackageOptions = {},
): Promise<StoryRuntimePackage> {
  const story = await loadStoryPackage(DEFAULT_BETA_STORY_ID, options);
  if (!['BETA', 'PUBLISHED'].includes(story.availability)) {
    throw new StoryLoadError('아직 공개되지 않은 이야기예요.', 'STORY_NOT_AVAILABLE');
  }
  return story;
}

async function storyLoadErrorFrom(response: Response): Promise<StoryLoadError> {
  let code: string | undefined;
  let safeDetail: string | undefined;
  let retryable: boolean | undefined;
  try {
    const body = (await response.json()) as {
      failure?: { code?: string; safeDetail?: string; retryable?: boolean };
    };
    code = body.failure?.code;
    safeDetail = body.failure?.safeDetail;
    retryable = body.failure?.retryable;
  } catch {
    // 실패 응답이 JSON이 아니면 (프록시/게이트웨이 오류 등) 아래 기본값으로 대체한다.
  }
  return new StoryLoadError(
    safeDetail ?? `이야기를 불러오지 못했어요. (HTTP ${response.status})`,
    code,
    response.status,
    // 봉투가 retryable을 주지 않으면 5xx만 재시도 가치가 있다고 본다 - 404
    // STORY_NOT_REGISTERED처럼 데이터가 없어서 나는 4xx는 다시 눌러도 같은 결과다.
    retryable ?? response.status >= 500,
  );
}

export type { StoryRuntimePackage } from './story-package';
