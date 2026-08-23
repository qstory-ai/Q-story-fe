import { speechApiUrl } from '@/entities/speech-pipeline';

import { buildStoryRuntimePackage, type StoryRuntimePackage } from './story-package';
import type { GeneratedStoryContent, StoryPackageData } from './story-package-types';
import {
  STORY_AUDIO_ASSETS_BY_ID,
  STORY_IMAGE_ASSETS_BY_ID,
} from './story-assets.generated';

export const DEFAULT_BETA_STORY_ID = 'HG';

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

async function fetchStoryPackage(
  storyId: string,
  { baseUrl = speechApiUrl, fetchImpl = fetch }: LoadStoryPackageOptions,
): Promise<StoryRuntimePackage> {
  if (!baseUrl) {
    throw new Error('VITE_QSTORY_API_URL is not configured - cannot load story content.');
  }
  const response = await fetchImpl.call(globalThis, `${baseUrl}/v1/stories/${storyId}/content`);
  if (!response.ok) {
    throw new Error(`Failed to load story "${storyId}": HTTP ${response.status}`);
  }
  const body = (await response.json()) as {
    generatedContent: GeneratedStoryContent;
    packageData: StoryPackageData;
  };
  // Asset maps are keyed by the content's own story id, not the (possibly aliased) request id -
  // these are always the same in practice, but keeping the lookup honest costs nothing.
  const contentStoryId = body.packageData.story.storyId;
  return buildStoryRuntimePackage({
    generatedContent: body.generatedContent,
    packageData: body.packageData,
    imageAssets: STORY_IMAGE_ASSETS_BY_ID[contentStoryId] ?? {},
    audioAssets: STORY_AUDIO_ASSETS_BY_ID[contentStoryId] ?? {},
  });
}

export async function getDefaultBetaStory(
  options: LoadStoryPackageOptions = {},
): Promise<StoryRuntimePackage> {
  const story = await loadStoryPackage(DEFAULT_BETA_STORY_ID, options);
  if (!['BETA', 'PUBLISHED'].includes(story.availability)) {
    throw new Error('Default beta story is unavailable.');
  }
  return story;
}

export type { StoryRuntimePackage } from './story-package';
