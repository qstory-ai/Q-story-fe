import { readEnv } from '@/shared/config';
import type { StoryRuntimePackage } from '@/entities/story';

import { HttpSpeechPipeline } from './http-speech-pipeline';
import { LocalSafeSpeechPipeline } from './local-safe-pipeline';
import type { SpeechPipeline } from './types';

export const speechApiUrl = readEnv('VITE_QSTORY_API_URL');

export const isRemoteSpeechPipelineConfigured = speechApiUrl.length > 0;

export function createConfiguredSpeechPipeline(
  storyPackage: StoryRuntimePackage,
): SpeechPipeline {
  return isRemoteSpeechPipelineConfigured
    ? new HttpSpeechPipeline(speechApiUrl, storyPackage)
    : new LocalSafeSpeechPipeline(storyPackage);
}
