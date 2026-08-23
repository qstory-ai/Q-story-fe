import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { AudioSource } from '@/entities/story';

import {
  useDeviceSpeechNarration,
  type NarrationRequest,
} from './use-device-speech-narration';

type FixedPlayback = {
  generation: number;
  requestId: string;
  started: boolean;
  timeoutId: ReturnType<typeof setTimeout> | null;
  remainingMillis: number;
  startedAt: number;
  resolve: () => void;
  reject: (error: Error) => void;
};

function interruptedError() {
  const error = new Error('낭독이 중단됐어요.');
  error.name = 'AbortError';
  return error;
}

const preloadCache = new Map<string, Promise<void>>();

export function preloadFixedNarration(
  requestIds: readonly string[],
  fixedNarrationAssets: Readonly<Record<string, AudioSource>>,
) {
  for (const requestId of requestIds) {
    const uri = fixedNarrationAssets[requestId]?.uri;
    if (!uri || preloadCache.has(uri)) {
      continue;
    }
    const pending = fetch(uri, { cache: 'force-cache' })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`preload failed: ${response.status}`);
        }
      })
      .catch(() => {
        preloadCache.delete(uri);
      });
    preloadCache.set(uri, pending);
  }
}

export function useStoryNarration(
  fixedNarrationAssets: Readonly<Record<string, AudioSource>>,
) {
  const {
    speak: speakDevice,
    stop: stopDevice,
    pause: pauseDevice,
    resume: resumeDevice,
    state: deviceState,
  } = useDeviceSpeechNarration();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const generationRef = useRef(0);
  const pendingRef = useRef<FixedPlayback | null>(null);
  const [activeSource, setActiveSource] =
    useState<'fixed' | 'device' | null>(null);
  const [fixedPlaying, setFixedPlaying] = useState(false);
  const [fixedPaused, setFixedPaused] = useState(false);
  const [fixedError, setFixedError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [captionRequestId, setCaptionRequestId] = useState<string | null>(null);

  const settleFixed = useCallback((error?: Error) => {
    const pending = pendingRef.current;
    if (!pending) {
      return;
    }
    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }
    pendingRef.current = null;
    setFixedPlaying(false);
    setFixedPaused(false);
    setActiveSource(null);
    if (error) {
      pending.reject(error);
    } else {
      setProgress(1);
      pending.resolve();
    }
  }, []);

  const armTimeout = useCallback(
    (pending: FixedPlayback) => {
      pending.startedAt = Date.now();
      pending.timeoutId = setTimeout(() => {
        if (pendingRef.current?.generation !== pending.generation) {
          return;
        }
        audioRef.current?.pause();
        settleFixed(
          new Error('고정 낭독 완료 신호를 기다리는 시간이 초과됐어요.'),
        );
      }, Math.max(1_000, pending.remainingMillis));
    },
    [settleFixed],
  );

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.setAttribute('playsinline', '');
    audioRef.current = audio;

    const onPlaying = () => {
      const pending = pendingRef.current;
      if (!pending) {
        return;
      }
      pending.started = true;
      setCaptionRequestId(pending.requestId);
      setFixedPlaying(true);
      setFixedPaused(false);
      setFixedError(null);
    };
    const onPause = () => {
      if (pendingRef.current && !audio.ended) {
        setFixedPlaying(false);
      }
    };
    const onTimeUpdate = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setProgress(Math.max(0, Math.min(1, audio.currentTime / audio.duration)));
      }
    };
    const onEnded = () => {
      if (pendingRef.current?.started) {
        settleFixed();
      }
    };
    const onError = () => {
      if (!pendingRef.current) {
        return;
      }
      const error = new Error('Safari에서 고정 낭독 음성을 재생하지 못했어요.');
      setFixedError(error.message);
      settleFixed(error);
    };

    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    return () => {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audioRef.current = null;
      settleFixed(interruptedError());
    };
  }, [settleFixed]);

  const stopFixed = useCallback(() => {
    generationRef.current += 1;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setProgress(0);
    settleFixed(interruptedError());
  }, [settleFixed]);

  const stop = useCallback(async () => {
    stopFixed();
    setActiveSource(null);
    await stopDevice();
  }, [stopDevice, stopFixed]);

  const playFixed = useCallback(
    (request: NarrationRequest, source: AudioSource) => {
      const audio = audioRef.current;
      const uri = source.uri;
      if (!audio || !uri) {
        return Promise.reject(
          new Error('고정 낭독 음성 주소를 준비하지 못했어요.'),
        );
      }

      generationRef.current += 1;
      const generation = generationRef.current;
      audio.pause();
      settleFixed(interruptedError());
      setActiveSource('fixed');
      setFixedPlaying(false);
      setFixedPaused(false);
      setFixedError(null);
      setProgress(0);

      return new Promise<void>((resolve, reject) => {
        const timeoutMillis = Math.min(
          120_000,
          Math.max(20_000, request.text.length * 300),
        );
        const pending: FixedPlayback = {
          generation,
          requestId: request.id,
          started: false,
          timeoutId: null,
          remainingMillis: timeoutMillis,
          startedAt: Date.now(),
          resolve,
          reject,
        };
        pendingRef.current = pending;
        armTimeout(pending);

        audio.src = uri;
        audio.currentTime = 0;
        audio.load();
        audio.play().catch((error: unknown) => {
          if (pendingRef.current?.generation !== generation) {
            return;
          }
          const playbackError =
            error instanceof Error
              ? error
              : new Error('고정 낭독 음성을 시작하지 못했어요.');
          setFixedError(playbackError.message);
          settleFixed(playbackError);
        });
      });
    },
    [armTimeout, settleFixed],
  );

  const speak = useCallback(
    async (request: NarrationRequest) => {
      await stopDevice();
      const fixedSource = fixedNarrationAssets[request.id];
      if (!fixedSource) {
        setActiveSource('device');
        setCaptionRequestId(request.id);
        try {
          await speakDevice(request);
        } finally {
          setActiveSource(null);
        }
        return;
      }
      try {
        await playFixed(request, fixedSource);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw error;
        }
        setActiveSource('device');
        setCaptionRequestId(request.id);
        try {
          await speakDevice(request);
        } finally {
          setActiveSource(null);
        }
      }
    },
    [fixedNarrationAssets, playFixed, speakDevice, stopDevice],
  );

  const pause = useCallback(async () => {
    if (activeSource === 'fixed' && fixedPlaying) {
      const pending = pendingRef.current;
      const audio = audioRef.current;
      if (!pending || !audio) {
        return false;
      }
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
        pending.timeoutId = null;
      }
      pending.remainingMillis = Math.max(
        1_000,
        pending.remainingMillis - (Date.now() - pending.startedAt),
      );
      audio.pause();
      setFixedPaused(true);
      return true;
    }
    return activeSource === 'device' ? pauseDevice() : false;
  }, [activeSource, fixedPlaying, pauseDevice]);

  const resume = useCallback(async () => {
    if (activeSource === 'fixed' && fixedPaused) {
      const pending = pendingRef.current;
      const audio = audioRef.current;
      if (!pending || !audio) {
        return false;
      }
      armTimeout(pending);
      try {
        await audio.play();
        setFixedPaused(false);
        return true;
      } catch {
        return false;
      }
    }
    return activeSource === 'device' ? resumeDevice() : false;
  }, [activeSource, armTimeout, fixedPaused, resumeDevice]);

  const state = useMemo(
    () => ({
      activeRequestId:
        activeSource === 'fixed'
          ? 'fixed-narration'
          : deviceState.activeRequestId,
      isSpeaking: fixedPlaying || deviceState.isSpeaking,
      isPaused: fixedPaused || deviceState.isPaused,
      error: fixedError ?? deviceState.error,
      source:
        activeSource === 'fixed' ? ('fixed' as const) : ('device' as const),
      progress:
        activeSource === 'fixed'
          ? progress
          : activeSource === 'device'
            ? deviceState.progress
            : 0,
      captionRequestId,
    }),
    [
      activeSource,
      captionRequestId,
      deviceState,
      fixedError,
      fixedPaused,
      fixedPlaying,
      progress,
    ],
  );

  return { speak, stop, pause, resume, state };
}
