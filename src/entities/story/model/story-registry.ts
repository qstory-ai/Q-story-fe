import {
  DEFAULT_BETA_STORY_ID,
  STORY_PACKAGES_BY_ID,
} from './story-registry.generated';

import type { StoryRuntimePackage } from './story-package';

export function getStoryPackage(storyId: string): StoryRuntimePackage | null {
  return STORY_PACKAGES_BY_ID[storyId] ?? null;
}

export function getDefaultBetaStory(): StoryRuntimePackage {
  const story = getStoryPackage(DEFAULT_BETA_STORY_ID);
  if (!story || !['BETA', 'PUBLISHED'].includes(story.availability)) {
    throw new Error('Default beta story is unavailable.');
  }
  return story;
}

export function registeredStoryPackages() {
  return Object.values(STORY_PACKAGES_BY_ID);
}

export type { StoryRuntimePackage } from './story-package';
