import { sanitizeNarrationText } from '@/entities/narration';

import type { BufferedResponseAudio, PcmStreamResponseAudio } from './response-audio';
import { positiveHeader } from './response-audio';

/** /v1/narrations(·/stream) 요청 본문. anchorId가 비어 있으면 백엔드는 스토리 캐스트인지만 확인한다. */
export type NarrationRequestFields = {
  storyId: string;
  anchorId: string;
  speakerId: string;
  text: string;
};

type NarrationResponse = {
  ok?: boolean;
  audio?: BufferedResponseAudio;
};

function requestBody(fields: NarrationRequestFields) {
  return JSON.stringify({ ...fields, text: sanitizeNarrationText(fields.text) });
}

/** 버퍼링 낭독 요청 - 실패·타임아웃·잘못된 응답은 모두 null. */
export async function fetchBufferedNarration(
  fields: NarrationRequestFields,
  fetchImpl: typeof fetch,
  baseUrl: string,
  timeoutMs: number,
  timeoutReason: string,
): Promise<BufferedResponseAudio | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(timeoutReason), timeoutMs);
  try {
    const response = await fetchImpl(`${baseUrl}/v1/narrations`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json' },
      body: requestBody(fields),
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as NarrationResponse;
    if (payload.ok !== true || !payload.audio?.mimeType || !payload.audio.dataBase64) {
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
 * PCM 스트리밍 낭독 요청. 스트림으로 쓸 수 없는 응답이면 null, 네트워크 오류·타임아웃·호출자 abort는
 * throw한다 - 버퍼링 폴백 여부는 호출자가 정한다.
 */
export async function fetchPcmNarrationStream(
  fields: NarrationRequestFields,
  fetchImpl: typeof fetch,
  baseUrl: string,
  timeoutMs: number,
  timeoutReason: string,
  signal?: AbortSignal,
): Promise<PcmStreamResponseAudio | null> {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeoutId = setTimeout(() => controller.abort(timeoutReason), timeoutMs);
  try {
    const response = await fetchImpl(`${baseUrl}/v1/narrations/stream`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        accept: 'audio/pcm',
        'content-type': 'application/json',
      },
      body: requestBody(fields),
    });
    const contentType = response.headers.get('content-type') ?? '';
    if (!response.ok || !contentType.includes('audio/pcm') || !response.body) {
      return null;
    }
    return {
      kind: 'pcm-stream',
      mimeType: 'audio/pcm',
      stream: response.body,
      sampleRate: positiveHeader(response, 'x-qstory-audio-sample-rate', 24_000),
      channels: 1,
      bitDepth: 16,
    };
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}
