import type { QuestionAnchor, StoryId } from '@/entities/story-runtime';
import { speechApiUrl } from '@/entities/speech-pipeline';

import { fetchBufferedNarration } from './narration-request';
import type { BufferedResponseAudio } from './response-audio';

export type GeneratedNarrationAudio = BufferedResponseAudio;

export type QuestionNarrationInput = {
  storyId: StoryId;
  anchor: QuestionAnchor;
  text: string;
};

type PreloadQuestionNarrationOptions = {
  attempts?: number;
  retryDelayMs?: number;
  load?: (
    input: QuestionNarrationInput,
  ) => Promise<GeneratedNarrationAudio | null>;
};

const narrationCache = new Map<
  string,
  Promise<GeneratedNarrationAudio | null>
>();

const DEFAULT_NARRATION_REQUEST_TIMEOUT_MS = 14_000;

export function questionNarrationFields(input: QuestionNarrationInput) {
  return {
    storyId: input.storyId,
    anchorId: input.anchor.id,
    speakerId: input.anchor.promptSpeakerId,
    text: input.text,
  };
}

function cacheKey(input: QuestionNarrationInput) {
  return [input.storyId, input.anchor.id, input.anchor.promptSpeakerId, input.text]
    .join('|');
}

export async function fetchQuestionNarration(
  input: QuestionNarrationInput,
  fetchImpl: typeof fetch = fetch,
  baseUrl = speechApiUrl,
  timeoutMs = DEFAULT_NARRATION_REQUEST_TIMEOUT_MS,
): Promise<GeneratedNarrationAudio | null> {
  if (!baseUrl) {
    return null;
  }
  return fetchBufferedNarration(
    questionNarrationFields(input),
    fetchImpl,
    baseUrl,
    timeoutMs,
    'narration-request-timeout',
  );
}

export function getQuestionNarration(
  input: QuestionNarrationInput,
): Promise<GeneratedNarrationAudio | null> {
  const key = cacheKey(input);
  const existing = narrationCache.get(key);
  if (existing) {
    return existing;
  }
  const pending: Promise<GeneratedNarrationAudio | null> = fetchQuestionNarration(input).then((audio) => {
    if (!audio && narrationCache.get(key) === pending) {
      narrationCache.delete(key);
    }
    return audio;
  });
  narrationCache.set(key, pending);
  return pending;
}

export async function preloadQuestionNarration(
  input: QuestionNarrationInput,
  options: PreloadQuestionNarrationOptions = {},
): Promise<GeneratedNarrationAudio | null> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? 1_000);
  const load = options.load ?? getQuestionNarration;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const audio = await load(input);
    if (audio) {
      return audio;
    }
    if (attempt < attempts - 1 && retryDelayMs > 0) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, retryDelayMs * (attempt + 1));
      });
    }
  }
  return null;
}
