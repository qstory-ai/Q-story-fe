import { speechApiUrl } from '@/entities/speech-pipeline';

import { buildStoryRuntimePackage, type StoryRuntimePackage } from './story-package';
import type { GeneratedStoryContent, StoryPackageData } from './story-package-types';
import {
  STORY_AUDIO_ASSETS_BY_ID,
  STORY_IMAGE_ASSETS_BY_ID,
} from './story-assets.generated';

const IMAGE_CATEGORIES = new Set(['SCENE_ART', 'BRANCH_ART']);

/**
 * DB가 콘텐츠와 함께 내려준 asset 목록(packageData.assets)에서 이미지만 골라 매핑한다 - 프론트
 * 빌드에 정적으로 번들된 STORY_IMAGE_ASSETS_BY_ID를 재배포 없이 갱신할 수 있게 하는 게 이
 * 필드의 존재 이유다(StoryContentAssemblyService.java 참고). 응답에 assets가 비어 있으면(아직
 * import되지 않은 스토리 등) 정적 번들로 폴백한다 - 삽화가 통째로 안 뜨는 것보다는 안전하다.
 */
function imageAssetsFromPackageData(
  packageData: StoryPackageData,
  fallback: Readonly<Record<string, { uri: string }>>,
) {
  const imageAssets = (packageData.assets ?? [])
    .filter((asset) => IMAGE_CATEGORIES.has(asset.category))
    .reduce<Record<string, { uri: string }>>((byAssetId, asset) => {
      byAssetId[asset.slug] = { uri: asset.url };
      return byAssetId;
    }, {});
  return Object.keys(imageAssets).length > 0 ? imageAssets : fallback;
}

export const DEFAULT_BETA_STORY_ID = 'HG';

type LoadStoryPackageOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

const packageCache = new Map<string, Promise<StoryRuntimePackage>>();

/**
 * 백엔드(GET /v1/stories/{storyId}/content - StoryContentAssemblyService 참고)에서 스토리의
 * 전체 내러티브 콘텐츠를 가져와서, 빌드 파이프라인이 빌드 타임에 실행하던 것과 동일한
 * buildStoryRuntimePackage()로 컴파일한다. 세션이 유지되는 동안 storyId별로 캐시된다 - 스토리를
 * 진행 중인 아이에게 콘텐츠가 도중에 바뀌는 일이 절대 있어서는 안 되기 때문이다.
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
    // 실패한 로드는 캐시하지 않는다 - 다음 호출(예: 재시도 버튼)에서 새로 시도할 수 있게 한다.
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
  // 에셋 맵은 (별칭일 수도 있는) 요청 id가 아니라 콘텐츠 자신의 story id를 키로 사용한다 -
  // 실제로는 항상 둘이 같지만, 조회 로직을 정직하게 유지해서 손해 볼 것은 없다.
  const contentStoryId = body.packageData.story.storyId;
  return buildStoryRuntimePackage({
    generatedContent: body.generatedContent,
    packageData: body.packageData,
    imageAssets: imageAssetsFromPackageData(
      body.packageData,
      STORY_IMAGE_ASSETS_BY_ID[contentStoryId] ?? {},
    ),
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
