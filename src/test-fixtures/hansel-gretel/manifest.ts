import {
  STORY_AUDIO_ASSETS_BY_ID,
  STORY_IMAGE_ASSETS_BY_ID,
  buildStoryRuntimePackage,
  type GeneratedStoryContent,
  type StoryPackageData,
} from '@/entities/story';
import generatedContent from '../../../content/stories/hansel-gretel/generated/generated-story-content.json';
import packageData from '../../../content/stories/hansel-gretel/generated/story-package.generated.json';

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

/** 백엔드 /content 응답처럼 쓰는 원본 생성물 - 레지스트리 테스트가 fetch를 흉내 낼 때 쓴다. */
export { generatedContent as hanselGretelGeneratedContent, packageData as hanselGretelPackageData };
