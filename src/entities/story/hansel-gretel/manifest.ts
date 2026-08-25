import { buildStoryRuntimePackage } from '../model/story-package';
import {
  STORY_AUDIO_ASSETS_BY_ID,
  STORY_IMAGE_ASSETS_BY_ID,
} from '../model/story-assets.generated';
import type { GeneratedStoryContent, StoryPackageData } from '../model/story-package-types';
import generatedContent from './generated-story-content.json';
import packageData from './story-package.generated.json';

// 회귀 테스트는 네트워크 왕복 없이 HG의 패키지를 동기적으로 필요로 한다 - 그래서
// story-registry.ts의 런타임 fetch를 거치는 대신, 백엔드 import(npm run content:import)가
// 시드로 사용하는 것과 동일한 로컬에 커밋된 fixture에서 곧바로 빌드한다. 실제 제품 런타임은
// 항상 story-registry.ts의 loadStoryPackage()/getDefaultBetaStory()를 통해 패키지를 읽는다.
export const hanselGretelStoryPackage = buildStoryRuntimePackage({
  generatedContent: generatedContent as unknown as GeneratedStoryContent,
  packageData: packageData as unknown as StoryPackageData,
  imageAssets: STORY_IMAGE_ASSETS_BY_ID.HG ?? {},
  audioAssets: STORY_AUDIO_ASSETS_BY_ID.HG ?? {},
});

export const hanselGretelManifest = hanselGretelStoryPackage.manifest;
export const hanselGretelPresentation = hanselGretelStoryPackage.presentation;
