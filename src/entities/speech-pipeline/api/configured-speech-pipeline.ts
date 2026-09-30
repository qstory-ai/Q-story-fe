import { apiBaseUrl } from '@/shared/config';
import type { StoryRuntimePackage } from '@/entities/story';

import { HttpSpeechPipeline } from './http-speech-pipeline';
import { LocalSafeSpeechPipeline } from './local-safe-pipeline';
import type { SpeechPipeline } from './types';

export const speechApiUrl = apiBaseUrl;

export function createConfiguredSpeechPipeline(
  storyPackage: StoryRuntimePackage,
): SpeechPipeline {
  return speechApiUrl.length > 0
    ? new HttpSpeechPipeline(speechApiUrl, storyPackage)
    : new LocalSafeSpeechPipeline(storyPackage);
}
