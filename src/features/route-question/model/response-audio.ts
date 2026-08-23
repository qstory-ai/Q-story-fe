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
