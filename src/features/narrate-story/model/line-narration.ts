import type { StoryId } from '@/entities/story-runtime';
import { speechApiUrl } from '@/entities/speech-pipeline';
import type { BufferedResponseAudio } from '../../route-question/model/response-audio';

/**
 * route-question/model/question-narration.ts와 거의 같지만 anchor가 없다 - 질문 지점에
 * 묶이지 않은 일반 대본 대사(특히 고정 오디오가 없는, 아이 이름이 들어간 문장)를 실시간으로
 * 오픈라우터 TTS로 만들 때 쓴다. 백엔드도 anchorId가 비어 있으면 anchor 기반
 * allowedSpeakerIds 검사를 건너뛰고 스토리에 등록된 캐스트인지만 확인한다
 * (StoryRegistryService.resolveNarrationContext).
 */
export type LineNarrationInput = {
  storyId: StoryId;
  speakerId: string;
  text: string;
};

export type GeneratedLineNarrationAudio = BufferedResponseAudio;

type NarrationResponse = {
  ok?: boolean;
  audio?: GeneratedLineNarrationAudio;
};

const narrationCache = new Map<
  string,
  Promise<GeneratedLineNarrationAudio | null>
>();

const DEFAULT_LINE_NARRATION_TIMEOUT_MS = 14_000;

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
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort('line-narration-request-timeout'),
    timeoutMs,
  );
  try {
    const response = await fetchImpl(`${baseUrl}/v1/narrations`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        storyId: input.storyId,
        anchorId: '',
        speakerId: input.speakerId,
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

export function getLineNarration(
  input: LineNarrationInput,
): Promise<GeneratedLineNarrationAudio | null> {
  const key = cacheKey(input);
  const existing = narrationCache.get(key);
  if (existing) {
    return existing;
  }
  const pending: Promise<GeneratedLineNarrationAudio | null> = fetchLineNarration(input).then(
    (audio) => {
      if (!audio && narrationCache.get(key) === pending) {
        narrationCache.delete(key);
      }
      return audio;
    },
  );
  narrationCache.set(key, pending);
  return pending;
}
