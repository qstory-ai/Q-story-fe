import { getStoryPackage } from '../model/story-registry';

const storyPackage = getStoryPackage('HG');
if (!storyPackage) {
  throw new Error('HG story package is not registered.');
}

// Compatibility exports for existing HG-focused regression tests. Product
// runtime reads the package through story-registry.ts.
export const hanselGretelManifest = storyPackage.manifest;
export const hanselGretelPresentation = storyPackage.presentation;
