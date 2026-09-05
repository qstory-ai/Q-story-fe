import type { StoryId } from '@/entities/story-runtime';
import { speechApiUrl } from '@/entities/speech-pipeline';
import type {
  BufferedResponseAudio,
  PcmStreamResponseAudio,
  ResponseAudio,
} from '../../route-question/model/response-audio';
import { positiveHeader, supportsStreamingPcm } from '../../route-question/model/response-audio';

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

const STREAM_LINE_NARRATION_TIMEOUT_MS = 14_000;

// 성공한 결과는 일부러 오래 남겨두지 않는다: pcm-stream 오디오는 ReadableStream을 한 번만 읽을 수
// 있어서, 같은 대사가 (리렌더 등으로) 다시 speak()되면 이미 소모된 스트림을 재생하려다 조용히
// 실패한다. 그래서 이 캐시는 "같은 요청이 아직 진행 중일 때 중복 호출을 하나로 묶는" 용도로만
// 쓰고, 성공/실패와 무관하게 요청이 끝나면 바로 비운다(예전엔 성공한 값만 세션 내내 재사용했다).
const narrationCache = new Map<
  string,
  Promise<ResponseAudio | null>
>();

// 실측 결과 이 TTS 생성 호출은 7~9초가 흔하고 가끔 14초를 넘기기도 한다 - 예전
// 14초 타임아웃은 그 느린 꼬리를 정상 응답 도중에 잘라 기기 TTS로 넘어가게 만들었다.
const DEFAULT_LINE_NARRATION_TIMEOUT_MS = 30_000;

function cacheKey(input: LineNarrationInput) {
  return [input.storyId, input.speakerId, input.text].join('|');
}

// The on-demand TTS backend (NarrationContractValidator) rejects any control character in `text`,
// including a literal newline - but multi-sentence fallback/branch lines carry '\n' between
// sentences by design (see manifest.test.ts's own normalizedText helper, which does the same
// flattening to compare against pre-recorded audio transcripts). Flatten here, at the network
// boundary, so on-screen captions can keep their line breaks while only the wire payload is
// squashed to what the backend actually accepts.
function sanitizeNarrationText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
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
        text: sanitizeNarrationText(input.text),
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

/**
 * fetchLineNarration()과 같은 조건(anchorId 없이 캐스트만 확인)이지만, PCM을 청크 단위로
 * 스트리밍해 받는다 - response-narration.ts의 getResponseNarration()과 동일한 패턴. 이 브라우저가
 * 스트리밍 재생을 못 하거나, 스트림 요청 자체가 실패하면 fetchLineNarration()(버퍼링)으로 넘어간다.
 * 대사 하나당 오디오 전체가 만들어질 때까지 기다리지 않고 첫 청크가 도착하는 대로 재생을 시작할 수
 * 있어(play-response-audio.ts의 playPcmStream 참고), 특히 실시간으로 새로 만들어지는 분기처럼 대사
 * 수가 많은 경우 체감 대기시간이 크게 줄어든다.
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
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort('line-narration-stream-timeout'),
    STREAM_LINE_NARRATION_TIMEOUT_MS,
  );
  try {
    const response = await fetchImpl(`${baseUrl}/v1/narrations/stream`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        accept: 'audio/pcm',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        storyId: input.storyId,
        anchorId: '',
        speakerId: input.speakerId,
        text: sanitizeNarrationText(input.text),
      }),
    });
    const contentType = response.headers.get('content-type') ?? '';
    if (!response.ok || !contentType.includes('audio/pcm') || !response.body) {
      return fetchLineNarration(input, fetchImpl, baseUrl);
    }
    const audio: PcmStreamResponseAudio = {
      kind: 'pcm-stream',
      mimeType: 'audio/pcm',
      stream: response.body,
      sampleRate: positiveHeader(response, 'x-qstory-audio-sample-rate', 24_000),
      channels: 1,
      bitDepth: 16,
    };
    return audio;
  } catch {
    return fetchLineNarration(input, fetchImpl, baseUrl);
  } finally {
    clearTimeout(timeoutId);
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
      // 성공이든 실패든 요청이 끝나면 캐시에서 지운다 - 위 캐시 주석 참고(pcm-stream은 재생 불가).
      if (narrationCache.get(key) === pending) {
        narrationCache.delete(key);
      }
      return audio;
    },
  );
  narrationCache.set(key, pending);
  return pending;
}
