import type {
  PcmStreamResponseAudio,
  ResponseAudio,
} from './response-audio';

const SILENT_WAV_DATA_URI =
  'data:audio/wav;base64,UklGRsQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

let sharedPlayer: HTMLAudioElement | null = null;
let sharedAudioContext: AudioContext | null = null;
let cancelActivePlayback: (() => void) | null = null;

function getSharedPlayer() {
  if (!sharedPlayer) {
    sharedPlayer = new Audio();
    sharedPlayer.preload = 'auto';
    sharedPlayer.setAttribute('playsinline', '');
  }
  return sharedPlayer;
}

function getSharedAudioContext() {
  if (!sharedAudioContext) {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return null;
    sharedAudioContext = new AudioContextClass();
  }
  return sharedAudioContext;
}

/**
 * Safari가 사용자 동작 뒤에 만들어진 동일한 오디오 요소의 후속 재생을
 * 허용하도록 이야기 시작 버튼을 누른 순간 플레이어를 준비한다.
 */
export function primeResponseAudio() {
  if (cancelActivePlayback) {
    return;
  }
  const player = getSharedPlayer();
  player.src = SILENT_WAV_DATA_URI;
  player.load();
  void player.play().then(
    () => {
      player.pause();
      player.currentTime = 0;
    },
    () => {
      // 실제 음성 재생에서 다시 시도한다. 준비 실패가 체험을 막아선 안 된다.
    },
  );
  const context = getSharedAudioContext();
  if (context) {
    void context.resume().then(() => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      gain.gain.value = 0;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.01);
    });
  }
}

function concatQueuedBytes(queue: Uint8Array[], length: number) {
  const result = new Uint8Array(length);
  let offset = 0;
  while (offset < length) {
    const head = queue[0];
    const needed = length - offset;
    const copied = Math.min(needed, head.byteLength);
    result.set(head.subarray(0, copied), offset);
    offset += copied;
    if (copied === head.byteLength) {
      queue.shift();
    } else {
      queue[0] = head.subarray(copied);
    }
  }
  return result;
}

async function playPcmStream(
  audioData: PcmStreamResponseAudio,
  signal: AbortSignal,
  onStarted?: () => void,
  onProgress?: (progress: number) => void,
  expectedDurationSeconds?: number,
): Promise<boolean> {
  const context = getSharedAudioContext();
  if (!context || signal.aborted) return false;
  await context.resume();

  cancelActivePlayback?.();
  const reader = audioData.stream.getReader();
  const sources = new Set<AudioBufferSourceNode>();
  const completions: Promise<void>[] = [];
  const queuedBytes: Uint8Array[] = [];
  const targetBytes = Math.max(
    2,
    Math.round(audioData.sampleRate * 0.24) * 2,
  );
  let queuedLength = 0;
  let nextStartTime = 0;
  let scheduledAudio = false;
  let aborted = false;
  let replaced = false;
  let timedOut = false;
  let startCallbackId: ReturnType<typeof setTimeout> | null = null;
  let progressIntervalId: ReturnType<typeof setInterval> | null = null;
  let firstStartTime: number | null = null;
  let finalDuration: number | null = null;

  const stopSources = () => {
    for (const source of sources) {
      try {
        source.stop();
      } catch {
        // 이미 끝난 source는 중단할 필요가 없다.
      }
    }
    sources.clear();
  };
  const abort = () => {
    aborted = true;
    void reader.cancel(signal.reason);
    stopSources();
  };
  const cancel = () => {
    replaced = true;
    void reader.cancel('playback-replaced');
    stopSources();
  };
  cancelActivePlayback = cancel;
  signal.addEventListener('abort', abort, { once: true });
  const startTimeoutId = setTimeout(() => {
    if (!scheduledAudio) {
      timedOut = true;
      void reader.cancel('pcm-start-timeout');
    }
  }, 4_000);

  const schedule = (bytes: Uint8Array) => {
    const evenLength = bytes.byteLength - (bytes.byteLength % 2);
    if (evenLength < 2) return;
    const sampleCount = evenLength / 2;
    const buffer = context.createBuffer(1, sampleCount, audioData.sampleRate);
    const samples = buffer.getChannelData(0);
    const view = new DataView(bytes.buffer, bytes.byteOffset, evenLength);
    for (let index = 0; index < sampleCount; index += 1) {
      samples[index] = view.getInt16(index * 2, true) / 32_768;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    const minimumLead = scheduledAudio ? 0.03 : 0.06;
    const startAt = Math.max(nextStartTime, context.currentTime + minimumLead);
    nextStartTime = startAt + buffer.duration;
    sources.add(source);
    completions.push(
      new Promise<void>((resolve) => {
        source.onended = () => {
          sources.delete(source);
          resolve();
        };
      }),
    );
    if (!scheduledAudio) {
      scheduledAudio = true;
      firstStartTime = startAt;
      clearTimeout(startTimeoutId);
      startCallbackId = setTimeout(
        () => {
          onStarted?.();
          onProgress?.(0);
        },
        Math.max(0, (startAt - context.currentTime) * 1_000),
      );
      progressIntervalId = setInterval(() => {
        if (firstStartTime === null) return;
        const elapsed = Math.max(0, context.currentTime - firstStartTime);
        const scheduledDuration = Math.max(
          0.1,
          nextStartTime - firstStartTime,
        );
        const duration =
          finalDuration ??
          Math.max(scheduledDuration, expectedDurationSeconds ?? 0);
        onProgress?.(
          Math.max(
            0,
            Math.min(finalDuration === null ? 0.98 : 1, elapsed / duration),
          ),
        );
      }, 100);
    }
    source.start(startAt);
  };

  try {
    while (!aborted && !replaced && !timedOut) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      queuedBytes.push(value);
      queuedLength += value.byteLength;
      while (queuedLength >= targetBytes) {
        schedule(concatQueuedBytes(queuedBytes, targetBytes));
        queuedLength -= targetBytes;
      }
    }
    if (!aborted && !replaced && queuedLength > 1) {
      const finalLength = queuedLength - (queuedLength % 2);
      schedule(concatQueuedBytes(queuedBytes, finalLength));
    }
    if (aborted) {
      throw signal.reason ?? new DOMException('Aborted', 'AbortError');
    }
    if (replaced || timedOut || !scheduledAudio) return false;
    if (firstStartTime !== null) {
      finalDuration = Math.max(0.1, nextStartTime - firstStartTime);
    }
    await Promise.all(completions);
    onProgress?.(1);
    return true;
  } catch {
    if (aborted) {
      throw signal.reason ?? new DOMException('Aborted', 'AbortError');
    }
    // 일부가 이미 재생됐다면 처음부터 기기 음성을 겹쳐 읽지 않는다.
    return scheduledAudio;
  } finally {
    clearTimeout(startTimeoutId);
    if (startCallbackId) clearTimeout(startCallbackId);
    if (progressIntervalId) clearInterval(progressIntervalId);
    signal.removeEventListener('abort', abort);
    if (cancelActivePlayback === cancel) cancelActivePlayback = null;
    if (replaced || aborted || timedOut) stopSources();
    try {
      reader.releaseLock();
    } catch {
      // cancel 직후 이미 해제된 reader일 수 있다.
    }
  }
}

export function playResponseAudio(
  audioData: ResponseAudio,
  signal: AbortSignal,
  onStarted?: () => void,
  onProgress?: (progress: number) => void,
  expectedDurationSeconds?: number,
): Promise<boolean> {
  if (audioData.kind === 'pcm-stream') {
    return playPcmStream(
      audioData,
      signal,
      onStarted,
      onProgress,
      expectedDurationSeconds,
    );
  }
  let objectUrl: string;
  try {
    const decoded = atob(audioData.dataBase64);
    const bytes = new Uint8Array(decoded.length);
    for (let index = 0; index < decoded.length; index += 1) {
      bytes[index] = decoded.charCodeAt(index);
    }
    objectUrl = URL.createObjectURL(
      new Blob([bytes], { type: audioData.mimeType }),
    );
  } catch {
    return Promise.resolve(false);
  }

  return new Promise((resolve, reject) => {
    const player = getSharedPlayer();
    let settled = false;
    let started = false;
    cancelActivePlayback?.();
    const startTimeoutId = setTimeout(() => finish(false), 4_000);
    let completionTimeoutId: ReturnType<typeof setTimeout> | null = null;
    const cleanup = () => {
      clearTimeout(startTimeoutId);
      if (completionTimeoutId) {
        clearTimeout(completionTimeoutId);
      }
      player.pause();
      player.onended = null;
      player.onerror = null;
      player.onplaying = null;
      player.ontimeupdate = null;
      player.removeAttribute('src');
      player.load();
      signal.removeEventListener('abort', abort);
      URL.revokeObjectURL(objectUrl);
      if (cancelActivePlayback === cancel) {
        cancelActivePlayback = null;
      }
    };
    const finish = (result: boolean, error?: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    };
    const abort = () => {
      finish(
        false,
        signal.reason ?? new DOMException('Aborted', 'AbortError'),
      );
    };
    const cancel = () => finish(false);
    cancelActivePlayback = cancel;
    player.onplaying = () => {
      if (started) {
        return;
      }
      started = true;
      onStarted?.();
      onProgress?.(0);
      clearTimeout(startTimeoutId);
      const durationMillis = Number.isFinite(player.duration)
        ? player.duration * 1_000
        : 0;
      completionTimeoutId = setTimeout(
        () => finish(false),
        Math.min(90_000, Math.max(20_000, durationMillis + 5_000)),
      );
    };
    player.ontimeupdate = () => {
      if (Number.isFinite(player.duration) && player.duration > 0) {
        onProgress?.(
          Math.max(0, Math.min(1, player.currentTime / player.duration)),
        );
      }
    };
    player.onended = () => {
      onProgress?.(1);
      finish(true);
    };
    player.onerror = () => finish(false);
    signal.addEventListener('abort', abort, { once: true });
    player.src = objectUrl;
    player.load();
    player.play().catch(() => {
      finish(false);
    });
  });
}
