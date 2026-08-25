import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { AudioSource } from '@/entities/story';
import type { StoryId } from '@/entities/story-runtime';

import {
  useDeviceSpeechNarration,
  type NarrationRequest,
} from './use-device-speech-narration';
import { getLineNarration } from './line-narration';
import { playResponseAudio } from '../../route-question/model/play-response-audio';

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
  storyId: StoryId,
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
  const liveAbortRef = useRef<AbortController | null>(null);
  // 'live' = 고정 오디오가 없어서 그 자리에서 오픈라우터 TTS를 불러 재생 중인 상태.
  const [activeSource, setActiveSource] =
    useState<'fixed' | 'live' | 'device' | null>(null);
  const [fixedPlaying, setFixedPlaying] = useState(false);
  const [fixedPaused, setFixedPaused] = useState(false);
  const [fixedError, setFixedError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [captionRequestId, setCaptionRequestId] = useState<string | null>(null);
  const [liveSpeaking, setLiveSpeaking] = useState(false);
  const [liveProgress, setLiveProgress] = useState(0);

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
    liveAbortRef.current?.abort(interruptedError());
    liveAbortRef.current = null;
    setLiveSpeaking(false);
    setLiveProgress(0);
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

  // 고정 오디오가 없는 대사(주로 아이 이름이 들어간 문장)를 그 자리에서 오픈라우터 TTS로
  // 만들어 재생한다 - 목소리가 고정 낭독과 이어지도록, 기기 TTS보다 먼저 시도한다.
  const speakLive = useCallback(
    async (request: NarrationRequest) => {
      const audio = await getLineNarration({
        storyId,
        speakerId: request.speakerId,
        text: request.text,
      });
      if (!audio) {
        return false;
      }
      const controller = new AbortController();
      liveAbortRef.current = controller;
      setActiveSource('live');
      setCaptionRequestId(request.id);
      setLiveProgress(0);
      try {
        return await playResponseAudio(
          audio,
          controller.signal,
          () => setLiveSpeaking(true),
          (value) => setLiveProgress(value),
        );
      } finally {
        setLiveSpeaking(false);
        setLiveProgress(0);
        if (liveAbortRef.current === controller) {
          liveAbortRef.current = null;
        }
      }
    },
    [storyId],
  );

  const speakFallback = useCallback(
    async (request: NarrationRequest) => {
      let played = false;
      try {
        played = await speakLive(request);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw error;
        }
      }
      if (played) {
        setActiveSource(null);
        return;
      }
      setActiveSource('device');
      setCaptionRequestId(request.id);
      try {
        await speakDevice(request);
      } finally {
        setActiveSource(null);
      }
    },
    [speakDevice, speakLive],
  );

  const speak = useCallback(
    async (request: NarrationRequest) => {
      await stopDevice();
      liveAbortRef.current?.abort(interruptedError());
      liveAbortRef.current = null;
      const fixedSource = fixedNarrationAssets[request.id];
      if (!fixedSource) {
        await speakFallback(request);
        return;
      }
      try {
        await playFixed(request, fixedSource);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw error;
        }
        await speakFallback(request);
      }
    },
    [fixedNarrationAssets, playFixed, speakFallback, stopDevice],
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
        activeSource === 'fixed' || activeSource === 'live'
          ? 'fixed-narration'
          : deviceState.activeRequestId,
      isSpeaking: fixedPlaying || liveSpeaking || deviceState.isSpeaking,
      isPaused: fixedPaused || deviceState.isPaused,
      error: fixedError ?? deviceState.error,
      // 실시간 오픈라우터 낭독('live')도 실제 캐릭터 목소리라 기기 TTS보다는 고정 낭독에
      // 더 가깝다 - 바깥에는 'fixed'로 묶어 노출한다.
      source:
        activeSource === 'device' ? ('device' as const) : ('fixed' as const),
      progress:
        activeSource === 'fixed'
          ? progress
          : activeSource === 'live'
            ? liveProgress
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
      liveProgress,
      liveSpeaking,
    ],
  );

  return { speak, stop, pause, resume, state };
}
