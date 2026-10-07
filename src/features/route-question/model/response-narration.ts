import { speechApiUrl } from '@/entities/speech-pipeline';

import { PrefetchDisabledError } from './choice-prefetch';
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

/**
 * 선택지 음성 미리 만들기 - 스트림 전용. 버퍼링 폴백(기존 키 TTS)은 절대 쓰지 않는다.
 * 409 PREFETCH_DISABLED는 PrefetchDisabledError로 던진다. 그 밖의 실패는 null(재시도 없음).
 */
export async function prefetchResponseNarration(
  input: QuestionNarrationInput,
  signal?: AbortSignal,
): Promise<ResponseAudio | null> {
  if (!speechApiUrl || !supportsStreamingPcm() || signal?.aborted) return null;
  try {
    return await fetchPcmNarrationStream(
      { ...questionNarrationFields(input), prefetch: true },
      fetch,
      speechApiUrl,
      STREAM_RESPONSE_TIMEOUT_MS,
      'narration-stream-timeout',
      signal,
    );
  } catch (error) {
    if (error instanceof PrefetchDisabledError) throw error;
    return null;
  }
}
