import type {
  PcmStreamResponseAudio,
  ResponseAudio,
} from './response-audio';

const SILENT_WAV_DATA_URI =
  'data:audio/wav;base64,UklGRsQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

let sharedPlayer: HTMLAudioElement | null = null;
let sharedAudioContext: AudioContext | null = null;
let cancelActivePlayback: (() => void) | null = null;
/**
 * 지금 재생 중인 playResponseAudio() 호출의 일시정지/재개 핸들(cancelActivePlayback과 같은 모듈 전역
 * 슬롯). 실시간 낭독과 동반자 채팅 응답 음성이 모두 이 함수를 거치므로 이 핸들 하나로 일시정지된다.
 * abort와 달리 나중에 이어 들을 수 있어야 해서 별도 메커니즘이다.
 */
let activePauseControls: { pause: () => void; resume: () => void } | null = null;

/** 지금 재생 중인 게 있으면 그대로 일시정지한다(끊어버리지 않음) - 없으면 조용히 아무 일도 안 한다. */
export function pauseActivePlayback(): boolean {
  if (!activePauseControls) return false;
  activePauseControls.pause();
  return true;
}

/** 방금 일시정지했던 재생을 이어서 계속한다. */
export function resumeActivePlayback(): boolean {
  if (!activePauseControls) return false;
  activePauseControls.resume();
  return true;
}

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

/** 미리 받아 풀어 둔 짧은 소리(그레텔 채움말 등) - 주소마다 한 번만 받는다. 실패하면 다음에 다시 시도한다. */
const decodedClipCache = new Map<string, Promise<AudioBuffer | null>>();

/**
 * 짧은 녹음을 받아 AudioBuffer로 풀어 둔다 - 재생할 때 오디오 요소처럼 다시 받거나 버퍼링하지 않고,
 * 답 음성(PCM 스트림)과 같은 AudioContext 시계로 바로 소리를 낸다.
 */
export function preloadDecodedClip(uri: string): Promise<AudioBuffer | null> {
  const cached = decodedClipCache.get(uri);
  if (cached) return cached;
  const context = getSharedAudioContext();
  if (!context) return Promise.resolve(null);
  const pending = fetch(uri, { cache: 'force-cache' })
    .then((response) => {
      if (!response.ok) throw new Error(`clip ${response.status}`);
      return response.arrayBuffer();
    })
    .then((bytes) => context.decodeAudioData(bytes))
    .catch(() => {
      decodedClipCache.delete(uri);
      return null;
    });
  decodedClipCache.set(uri, pending);
  return pending;
}

/** 공유 AudioContext의 지금 시각(초) - 채움말과 답 음성이 같은 시계를 쓴다. */
export function audioClockNow(): number {
  return getSharedAudioContext()?.currentTime ?? 0;
}

/** 풀어 둔 짧은 소리 한 번. 시각은 audioClockNow()와 같은 시계(초). */
export type DecodedClipPlayback = {
  startAt: number;
  endAt: number;
  /** 끝났거나(끝까지·줄여 끔·멈춤) 시작하지 못하면 풀린다. */
  ended: Promise<void>;
  /** from부터 to까지 소리를 줄이고 to에 멈춘다. */
  fadeOut: (from: number, to: number) => void;
  stop: () => void;
};

/**
 * 풀어 둔 소리를 바로 재생한다(살짝의 여유 lead 뒤). 답 음성의 cancelActivePlayback 슬롯은 쓰지 않는다 -
 * 답이 시작할 때 툭 끊지 않고 호출부가 줄여 끈다.
 */
export function playDecodedClip(buffer: AudioBuffer, lead = 0.02): DecodedClipPlayback | null {
  const context = getSharedAudioContext();
  if (!context) return null;
  if (context.state !== 'running') void context.resume().catch(() => {});
  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = buffer;
  source.connect(gain);
  gain.connect(context.destination);
  const startAt = context.currentTime + lead;
  let endAt = startAt + buffer.duration;
  let stopped = false;
  const ended = new Promise<void>((resolve) => {
    source.onended = () => {
      stopped = true;
      source.disconnect();
      gain.disconnect();
      resolve();
    };
  });
  source.start(startAt);
  const playback: DecodedClipPlayback = {
    startAt,
    get endAt() {
      return endAt;
    },
    ended,
    fadeOut: (from, to) => {
      if (stopped) return;
      const begin = Math.max(context.currentTime, from);
      const end = Math.max(begin + 0.005, to);
      gain.gain.cancelScheduledValues(begin);
      gain.gain.setValueAtTime(gain.gain.value, begin);
      gain.gain.linearRampToValueAtTime(0, end);
      endAt = Math.min(endAt, end);
      try {
        source.stop(end);
      } catch {
        // 이미 멈춘 source.
      }
    },
    stop: () => {
      if (stopped) return;
      endAt = Math.min(endAt, context.currentTime);
      try {
        source.stop();
      } catch {
        // 이미 멈춘 source.
      }
    },
  };
  return playback;
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
  onScheduled?: (startAt: number) => void,
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
  // 개별 source를 일시정지하는 API가 없어 AudioContext 클록 자체를 suspend/resume한다 - 예약된
  // source들은 멈춘 지점부터 이어진다. 이 경로엔 완료 타임아웃이 없어 재조정도 필요 없다.
  const pauseControls = {
    pause: () => {
      void context.suspend();
    },
    resume: () => {
      void context.resume();
    },
  };
  activePauseControls = pauseControls;
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
      onScheduled?.(startAt);
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
    if (activePauseControls === pauseControls) activePauseControls = null;
    if (replaced || aborted || timedOut) stopSources();
    try {
      reader.releaseLock();
    } catch {
      // cancel 직후 이미 해제된 reader일 수 있다.
    }
  }
}

/**
 * onScheduled: 첫 소리가 날 시각이 정해진 순간(audioClockNow() 시계, 초) - PCM이면 첫 조각을 예약할 때,
 * 전체 음성이면 재생을 시작하기 직전(지금). 앞서 나오던 소리(채움말)를 그에 맞춰 줄여 끈다.
 */
export function playResponseAudio(
  audioData: ResponseAudio,
  signal: AbortSignal,
  onStarted?: () => void,
  onProgress?: (progress: number) => void,
  expectedDurationSeconds?: number,
  onScheduled?: (startAt: number) => void,
): Promise<boolean> {
  if (audioData.kind === 'pcm-stream') {
    return playPcmStream(
      audioData,
      signal,
      onStarted,
      onProgress,
      expectedDurationSeconds,
      onScheduled,
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
    // 완료 타임아웃의 절대 시각. 일시정지하면 남은 시간만 기억해 두었다가 재개할 때 그만큼 다시
    // 건다 - 채팅으로 오래 멈춘 사이 타임아웃이 흘러가 재개 즉시 "재생 실패"가 되지 않게.
    let completionDeadlineAt: number | null = null;
    let pausedRemainingMs: number | null = null;
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
      if (activePauseControls === pauseControls) {
        activePauseControls = null;
      }
    };
    const pauseControls = {
      pause: () => {
        if (completionTimeoutId) {
          clearTimeout(completionTimeoutId);
          completionTimeoutId = null;
          if (completionDeadlineAt !== null) {
            pausedRemainingMs = Math.max(0, completionDeadlineAt - Date.now());
          }
        }
        player.pause();
      },
      resume: () => {
        if (pausedRemainingMs !== null) {
          const remainingMs = Math.max(1_000, pausedRemainingMs);
          pausedRemainingMs = null;
          completionDeadlineAt = Date.now() + remainingMs;
          completionTimeoutId = setTimeout(() => finish(false), remainingMs);
        }
        void player.play().catch(() => {});
      },
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
    activePauseControls = pauseControls;
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
      const completionDelayMillis = Math.min(
        90_000,
        Math.max(20_000, durationMillis + 5_000),
      );
      completionDeadlineAt = Date.now() + completionDelayMillis;
      completionTimeoutId = setTimeout(
        () => finish(false),
        completionDelayMillis,
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
    onScheduled?.(audioClockNow());
    player.play().catch(() => {
      finish(false);
    });
  });
}
