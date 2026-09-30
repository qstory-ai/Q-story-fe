import type { StoryId } from '@/entities/story-runtime';
import { speechApiUrl } from '@/entities/speech-pipeline';
import {
  fetchBufferedNarration,
  fetchPcmNarrationStream,
} from '../../route-question/model/narration-request';
import type {
  BufferedResponseAudio,
  ResponseAudio,
} from '../../route-question/model/response-audio';
import { supportsStreamingPcm } from '../../route-question/model/response-audio';

/**
 * 질문 낭독(route-question/model/question-narration.ts)과 같지만 anchor가 없다 - 질문 지점에
 * 묶이지 않은 일반 대사(특히 고정 오디오가 없는, 아이 이름이 들어간 문장)를 실시간 TTS로 만들 때
 * 쓴다. 백엔드는 anchorId가 비어 있으면 스토리에 등록된 캐스트인지만 확인한다
 * (StoryRegistryService.resolveNarrationContext).
 */
export type LineNarrationInput = {
  storyId: StoryId;
  speakerId: string;
  text: string;
};

export type GeneratedLineNarrationAudio = BufferedResponseAudio;

const STREAM_LINE_NARRATION_TIMEOUT_MS = 14_000;

// 진행 중인 같은 요청만 하나로 묶고, 끝나면 성공/실패와 무관하게 바로 비운다 - pcm-stream 오디오는
// ReadableStream을 한 번만 읽을 수 있어 완료된 결과를 재사용하면 소모된 스트림을 재생하게 된다.
const narrationCache = new Map<
  string,
  Promise<ResponseAudio | null>
>();

// 실측상 이 TTS 생성 호출은 7~9초가 흔하고 가끔 14초를 넘긴다 - 느린 정상 응답을 자르지 않게 넉넉히.
const DEFAULT_LINE_NARRATION_TIMEOUT_MS = 30_000;

function lineNarrationFields(input: LineNarrationInput) {
  return { storyId: input.storyId, anchorId: '', speakerId: input.speakerId, text: input.text };
}

function cacheKey(input: LineNarrationInput) {
  return [input.storyId, input.speakerId, input.text].join('|');
}

export async function fetchLineNarration(
  input: LineNarrationInput,
  fetchImpl: typeof fetch = fetch,
  baseUrl = speechApiUrl,
  timeoutMs = DEFAULT_LINE_NARRATION_TIMEOUT_MS,
): Promise<GeneratedLineNarrationAudio | null> {
  if (!baseUrl) {
    return null;
  }
  return fetchBufferedNarration(
    lineNarrationFields(input),
    fetchImpl,
    baseUrl,
    timeoutMs,
    'line-narration-request-timeout',
  );
}

/**
 * fetchLineNarration()과 같은 조건이지만 PCM을 청크 단위로 스트리밍해 받는다 - 첫 청크가 도착하는
 * 대로 재생을 시작할 수 있어 대사가 많은 분기에서 체감 대기시간이 크게 줄어든다. 이 브라우저가
 * 스트리밍 재생을 못 하거나 스트림 요청이 실패하면 fetchLineNarration()(버퍼링)으로 넘어간다.
 */
export async function fetchLineNarrationStream(
  input: LineNarrationInput,
  fetchImpl: typeof fetch = fetch,
  baseUrl = speechApiUrl,
): Promise<ResponseAudio | null> {
  if (!baseUrl) {
    return null;
  }
  if (!supportsStreamingPcm()) {
    return fetchLineNarration(input, fetchImpl, baseUrl);
  }
  try {
    const audio = await fetchPcmNarrationStream(
      lineNarrationFields(input),
      fetchImpl,
      baseUrl,
      STREAM_LINE_NARRATION_TIMEOUT_MS,
      'line-narration-stream-timeout',
    );
    return audio ?? (await fetchLineNarration(input, fetchImpl, baseUrl));
  } catch {
    return fetchLineNarration(input, fetchImpl, baseUrl);
  }
}

export function getLineNarration(
  input: LineNarrationInput,
  fetchImpl: typeof fetch = fetch,
  baseUrl = speechApiUrl,
): Promise<ResponseAudio | null> {
  const key = cacheKey(input);
  const existing = narrationCache.get(key);
  if (existing) {
    return existing;
  }
  const pending: Promise<ResponseAudio | null> = fetchLineNarrationStream(input, fetchImpl, baseUrl).then(
    (audio) => {
      // 성공이든 실패든 요청이 끝나면 캐시에서 지운다 - 위 캐시 주석 참고.
      if (narrationCache.get(key) === pending) {
        narrationCache.delete(key);
      }
      return audio;
    },
  );
  narrationCache.set(key, pending);
  return pending;
}
