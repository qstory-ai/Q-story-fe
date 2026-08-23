import { buildStoryRuntimePackage } from '../model/story-package';
import {
  STORY_AUDIO_ASSETS_BY_ID,
  STORY_IMAGE_ASSETS_BY_ID,
} from '../model/story-assets.generated';
import type { GeneratedStoryContent, StoryPackageData } from '../model/story-package-types';
import generatedContent from './generated-story-content.json';
import packageData from './story-package.generated.json';

// Regression tests need HG's package synchronously, without a network round trip - so this builds
// straight from the same locally-committed fixtures the backend import (npm run content:import)
// is seeded from, instead of going through story-registry.ts's runtime fetch. Product runtime
// always reads the package through story-registry.ts's loadStoryPackage()/getDefaultBetaStory().
export const hanselGretelStoryPackage = buildStoryRuntimePackage({
  generatedContent: generatedContent as unknown as GeneratedStoryContent,
  packageData: packageData as unknown as StoryPackageData,
  imageAssets: STORY_IMAGE_ASSETS_BY_ID.HG ?? {},
  audioAssets: STORY_AUDIO_ASSETS_BY_ID.HG ?? {},
});

export const hanselGretelManifest = hanselGretelStoryPackage.manifest;
export const hanselGretelPresentation = hanselGretelStoryPackage.presentation;
