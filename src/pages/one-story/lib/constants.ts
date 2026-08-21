import { getDefaultBetaStory } from '@/entities/story';
import { createConfiguredSpeechPipeline } from '@/entities/speech-pipeline';
import { trackBetaEvent, type BetaEventName } from '@/entities/analytics';
import { readEnv } from '@/shared/config';

export const speechPipeline = createConfiguredSpeechPipeline();
export const storyPackage = getDefaultBetaStory();
export const storyManifest = storyPackage.manifest;
export const storyPresentation = storyPackage.presentation;
export const TOTAL_SCENES = storyPresentation.scenes.length;

export const EXIT_REASONS = [
  '기다림이 길었어요',
  '음성 질문이 어려웠어요',
  '소리가 끊기거나 이상했어요',
  '자막이 음성과 맞지 않았어요',
  '그림이나 내용이 어색했어요',
  '아이가 흥미를 잃었어요',
  '이야기나 화면이 어려웠어요',
  '시간이 부족했어요',
] as const;

export const EXIT_REASON_CODES: Record<(typeof EXIT_REASONS)[number], string> = {
  '기다림이 길었어요': 'long_wait',
  '음성 질문이 어려웠어요': 'voice_difficulty',
  '소리가 끊기거나 이상했어요': 'audio_issue',
  '자막이 음성과 맞지 않았어요': 'caption_sync_issue',
  '그림이나 내용이 어색했어요': 'visual_or_story_issue',
  '아이가 흥미를 잃었어요': 'lost_interest',
  '이야기나 화면이 어려웠어요': 'content_difficulty',
  '시간이 부족했어요': 'not_enough_time',
};

export const QUESTION_AUDIO_HEAD_START_MS = 2_000;
// Operational checks have seen TTS prep take up to ~10.7s. Falling back to
// device TTS at 8s would replace Gretel's voice with a robotic one, so the
// character voice gets a bit more time before the device fallback kicks in.
export const RESPONSE_AUDIO_PREPARE_MS = 12_000;
export const FIXED_AUDIO_FAILURE_RECOVERY_MS = 2_500;

export const LANDING_URL = readEnv('VITE_QSTORY_LANDING_URL') || 'https://qstory.ai.kr';

export function trackStoryEvent(
  eventName: BetaEventName,
  metadata: Record<string, string | number | boolean> = {},
) {
  return trackBetaEvent(eventName, {
    story_version: storyManifest.contentVersion,
    ...metadata,
  });
}
