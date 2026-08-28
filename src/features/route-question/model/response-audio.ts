export type BufferedResponseAudio = {
  kind?: 'buffered';
  mimeType: string;
  dataBase64: string;
};

export type PcmStreamResponseAudio = {
  kind: 'pcm-stream';
  mimeType: 'audio/pcm';
  stream: ReadableStream<Uint8Array>;
  sampleRate: number;
  channels: 1;
  bitDepth: 16;
};

export type ResponseAudio = BufferedResponseAudio | PcmStreamResponseAudio;

/** 이 브라우저가 PCM 스트리밍 재생(AudioContext + ReadableStream)을 지원하는지 - 스트리밍을 시도하기 전에 항상 이걸로 먼저 확인한다. */
export function supportsStreamingPcm() {
  return (
    typeof window !== 'undefined' &&
    Boolean(
      window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext,
    ) &&
    typeof ReadableStream !== 'undefined'
  );
}

/** 스트리밍 응답 헤더(x-qstory-audio-*)에서 양의 정수를 읽고, 없거나 이상하면 fallback을 쓴다. */
export function positiveHeader(response: Response, name: string, fallback: number) {
  const parsed = Number.parseInt(response.headers.get(name) ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
