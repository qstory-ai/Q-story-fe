import type { QuestionAnchor, StoryId } from '@/entities/story-runtime';
import { speechApiUrl } from '@/entities/speech-pipeline';
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

type NarrationResponse = {
  ok?: boolean;
  audio?: GeneratedNarrationAudio;
};

const narrationCache = new Map<
  string,
  Promise<GeneratedNarrationAudio | null>
>();

const DEFAULT_NARRATION_REQUEST_TIMEOUT_MS = 14_000;

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
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort('narration-request-timeout'),
    timeoutMs,
  );
  try {
    const response = await fetchImpl(`${baseUrl}/v1/narrations`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        storyId: input.storyId,
        anchorId: input.anchor.id,
        speakerId: input.anchor.promptSpeakerId,
        text: input.text,
      }),
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as NarrationResponse;
    if (
      payload.ok !== true ||
      !payload.audio?.mimeType ||
      !payload.audio.dataBase64
    ) {
      return null;
    }
    return payload.audio;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
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
