import generatedContentJson from './generated-story-content.json';

import type { GeneratedStoryContent } from '../model/story-package-types';

export type {
  GeneratedFallback,
  GeneratedStoryContent,
  GeneratedStoryScene,
  GeneratedStorySegment,
  GeneratedVisual,
  QuestionSlot,
} from '../model/story-package-types';

export const generatedHanselGretelContent =
  generatedContentJson as GeneratedStoryContent;
