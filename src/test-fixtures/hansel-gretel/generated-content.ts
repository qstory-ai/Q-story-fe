import generatedContentJson from '../../../content/stories/hansel-gretel/generated/generated-story-content.json';

import type { GeneratedStoryContent } from '@/entities/story';

export type {
  GeneratedFallback,
  GeneratedStoryContent,
  GeneratedStoryScene,
  GeneratedStorySegment,
  GeneratedVisual,
  QuestionSlot,
} from '@/entities/story';

export const generatedHanselGretelContent =
  generatedContentJson as GeneratedStoryContent;
