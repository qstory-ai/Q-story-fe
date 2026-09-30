import { speechApiUrl } from '@/entities/speech-pipeline';

import { fetchPcmNarrationStream } from './narration-request';
import type { QuestionNarrationInput } from './question-narration';
import { getQuestionNarration, questionNarrationFields } from './question-narration';
import type { ResponseAudio } from './response-audio';
import { supportsStreamingPcm } from './response-audio';

const STREAM_RESPONSE_TIMEOUT_MS = 14_000;

export async function getResponseNarration(
  input: QuestionNarrationInput,
  signal?: AbortSignal,
): Promise<ResponseAudio | null> {
  if (!speechApiUrl || !supportsStreamingPcm() || signal?.aborted) {
    return getQuestionNarration(input);
  }

  try {
    const audio = await fetchPcmNarrationStream(
      questionNarrationFields(input),
      fetch,
      speechApiUrl,
      STREAM_RESPONSE_TIMEOUT_MS,
      'narration-stream-timeout',
      signal,
    );
    return audio ?? getQuestionNarration(input);
  } catch {
    if (signal?.aborted) return null;
    return getQuestionNarration(input);
  }
}
