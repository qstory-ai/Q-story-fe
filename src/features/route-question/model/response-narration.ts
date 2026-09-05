import { speechApiUrl } from '@/entities/speech-pipeline';
import { sanitizeNarrationText } from '@/entities/narration';

import type { QuestionNarrationInput } from './question-narration';
import { getQuestionNarration } from './question-narration';
import type { PcmStreamResponseAudio, ResponseAudio } from './response-audio';
import { positiveHeader, supportsStreamingPcm } from './response-audio';

const STREAM_RESPONSE_TIMEOUT_MS = 14_000;

export async function getResponseNarration(
  input: QuestionNarrationInput,
  signal?: AbortSignal,
): Promise<ResponseAudio | null> {
  if (!speechApiUrl || !supportsStreamingPcm() || signal?.aborted) {
    return getQuestionNarration(input);
  }

  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeoutId = setTimeout(
    () => controller.abort('narration-stream-timeout'),
    STREAM_RESPONSE_TIMEOUT_MS,
  );
  try {
    const response = await fetch(`${speechApiUrl}/v1/narrations/stream`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        accept: 'audio/pcm',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        storyId: input.storyId,
        anchorId: input.anchor.id,
        speakerId: input.anchor.promptSpeakerId,
        text: sanitizeNarrationText(input.text),
      }),
    });
    const contentType = response.headers.get('content-type') ?? '';
    if (!response.ok || !contentType.includes('audio/pcm') || !response.body) {
      return getQuestionNarration(input);
    }
    const audio: PcmStreamResponseAudio = {
      kind: 'pcm-stream',
      mimeType: 'audio/pcm',
      stream: response.body,
      sampleRate: positiveHeader(
        response,
        'x-qstory-audio-sample-rate',
        24_000,
      ),
      channels: 1,
      bitDepth: 16,
    };
    return audio;
  } catch {
    if (signal?.aborted) return null;
    return getQuestionNarration(input);
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}
