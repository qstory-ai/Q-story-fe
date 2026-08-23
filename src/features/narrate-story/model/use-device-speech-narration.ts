import { useCallback, useRef, useState } from 'react';

export type NarrationRequest = {
  id: string;
  text: string;
  speakerId: string;
  language: 'ko-KR';
};

export type NarrationState = {
  activeRequestId: string | null;
  isSpeaking: boolean;
  isPaused: boolean;
  error: string | null;
  progress: number;
};

const INITIAL_STATE: NarrationState = {
  activeRequestId: null,
  isSpeaking: false,
  isPaused: false,
  error: null,
  progress: 0,
};

function voiceStyle(speakerId: string) {
  if (speakerId.includes('HANSEL')) {
    return { pitch: 1.08, rate: 0.86 };
  }
  if (speakerId.includes('GRETEL')) {
    return { pitch: 1.14, rate: 0.86 };
  }
  if (speakerId.includes('WITCH') || speakerId.includes('OLD_WOMAN')) {
    return { pitch: 0.86, rate: 0.78 };
  }
  return { pitch: 1, rate: 0.82 };
}

/** Browser fallback narration via the Web Speech API, used when a fixed audio clip is unavailable. */
export function useDeviceSpeechNarration() {
  const [state, setState] = useState<NarrationState>(INITIAL_STATE);
  const generationRef = useRef(0);

  const stop = useCallback(async () => {
    generationRef.current += 1;
    window.speechSynthesis?.cancel();
    setState(INITIAL_STATE);
  }, []);

  const speak = useCallback(async (request: NarrationRequest) => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;

    if (typeof window === 'undefined' || !window.speechSynthesis) {
      const error = new Error('이 브라우저는 기기 낭독을 지원하지 않아요.');
      setState({ ...INITIAL_STATE, error: error.message });
      throw error;
    }

    window.speechSynthesis.cancel();
    setState({
      activeRequestId: request.id,
      isSpeaking: true,
      isPaused: false,
      error: null,
      progress: 0,
    });

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      let started = false;
      const startTimeoutId = setTimeout(() => {
        if (settled || started || generationRef.current !== generation) {
          return;
        }
        finish(new Error('기기 낭독을 시작하지 못했어요.'));
      }, 4_000);
      const timeoutMillis = Math.min(
        120_000,
        Math.max(20_000, request.text.length * 260),
      );
      const timeoutId = setTimeout(() => {
        if (settled || generationRef.current !== generation) {
          return;
        }
        settled = true;
        const message = '기기 낭독 완료 신호를 기다리는 시간이 초과됐어요.';
        setState({
          activeRequestId: null,
          isSpeaking: false,
          isPaused: false,
          error: message,
          progress: 0,
        });
        window.speechSynthesis.cancel();
        reject(new Error(message));
      }, timeoutMillis);

      const finish = (error?: Error) => {
        if (settled || generationRef.current !== generation) {
          return;
        }
        settled = true;
        clearTimeout(startTimeoutId);
        clearTimeout(timeoutId);
        setState({
          activeRequestId: null,
          isSpeaking: false,
          isPaused: false,
          error: error?.message ?? null,
          progress: error ? 0 : 1,
        });
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      };

      const style = voiceStyle(request.speakerId);
      const utterance = new SpeechSynthesisUtterance(request.text);
      utterance.lang = request.language;
      utterance.pitch = style.pitch;
      utterance.rate = style.rate;
      utterance.onstart = () => {
        started = true;
        clearTimeout(startTimeoutId);
      };
      utterance.onboundary = (event) => {
        const characterIndex = Math.max(0, event.charIndex ?? 0);
        const characterLength = Math.max(0, event.charLength ?? 0);
        const progress = Math.min(
          0.99,
          (characterIndex + characterLength) /
            Math.max(1, request.text.length),
        );
        setState((current) =>
          generationRef.current === generation
            ? { ...current, progress }
            : current,
        );
      };
      utterance.onend = () => finish();
      utterance.onerror = (event) =>
        finish(
          event.error === 'canceled' || event.error === 'interrupted'
            ? undefined
            : new Error('기기 낭독을 재생하지 못했어요.'),
        );

      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const pause = useCallback(async () => {
    if (!state.activeRequestId || !state.isSpeaking) {
      return false;
    }
    try {
      window.speechSynthesis.pause();
      setState((current) => ({
        ...current,
        isSpeaking: false,
        isPaused: true,
      }));
      return true;
    } catch {
      return false;
    }
  }, [state.activeRequestId, state.isSpeaking]);

  const resume = useCallback(async () => {
    if (!state.activeRequestId || !state.isPaused) {
      return false;
    }
    try {
      window.speechSynthesis.resume();
      setState((current) => ({
        ...current,
        isSpeaking: true,
        isPaused: false,
      }));
      return true;
    } catch {
      return false;
    }
  }, [state.activeRequestId, state.isPaused]);

  return { speak, stop, pause, resume, state };
}
