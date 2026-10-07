import { useEffect, useRef, useState } from 'react';

import { createNoSpeechTimer } from './no-speech-timer';
import { createSilenceDetector } from './silence-detector';
import type { AudioRecorderAdapter } from './types';

export const MAX_VOICE_RECORDING_MS = 30_000;
export const NO_SPEECH_REPROMPT_COPY = '궁금한 거 있으면 말해 줘~';
export const LISTEN_NOW_COPY = '지금 말해 줘!';

type Handlers = {
  /** 말한 뒤 조용해졌다(또는 30초 상한) - 녹음을 끝내고 받아 적는다. */
  onSpeechEnd: () => void;
  /** 15초 동안 말이 없었다 - 화면에 다시 묻는 문구가 뜬다(reprompted). */
  onReprompt?: () => void;
  /** 다시 물은 뒤 15초도 말이 없었다(또는 말 없이 30초 상한) - 보내지 말고 녹음을 버린다. */
  onGiveUp: () => void;
};

/**
 * 녹음 중 소리 크기 프레임으로 "말이 끝났는지"와 "말이 없는지"를 지켜보고, 30초 상한도 함께 센다(Q-34).
 * 소리 크기를 잴 수 없는 브라우저(멈춘 AudioContext 등)에선 프레임이 오지 않아 무음·무응답 판정을 하지 않는다
 * - 그때는 기존처럼 "다 했어요" 버튼과 30초 상한(받아 적기)으로 끝난다.
 * 콜백은 ref로 들고 있어서, 매 렌더 바뀌는 콜백을 넘겨도 타이머가 다시 시작되지 않는다.
 */
export function useSpeechAutoStop(
  recorder: Pick<AudioRecorderAdapter, 'isRecording' | 'subscribeLevel'>,
  {
    enabled,
    maxMs = MAX_VOICE_RECORDING_MS,
    ...handlers
  }: Handlers & { enabled: boolean; maxMs?: number },
) {
  const { isRecording, subscribeLevel } = recorder;
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  // 새 녹음이 시작되면 다시 묻는 문구를 지운다(렌더 중 상태 맞추기).
  const [reprompted, setReprompted] = useState(false);
  const [seenRecording, setSeenRecording] = useState(isRecording);
  if (seenRecording !== isRecording) {
    setSeenRecording(isRecording);
    if (isRecording) setReprompted(false);
  }

  useEffect(() => {
    if (!isRecording || !enabled) return;

    const detector = createSilenceDetector();
    let finished = false;
    let heardSpeech = false;
    let monitoring = false;
    const noSpeech = createNoSpeechTimer({
      onReprompt: () => {
        setReprompted(true);
        handlersRef.current.onReprompt?.();
      },
      onGiveUp: () => {
        finished = true;
        handlersRef.current.onGiveUp();
      },
    });
    const unsubscribe = subscribeLevel((frame) => {
      if (finished) return;
      if (!monitoring) {
        // 첫 프레임 = 소리를 잴 수 있게 된 순간부터 15초를 센다.
        monitoring = true;
        noSpeech.start();
      }
      const decision = detector.push(frame);
      if (!heardSpeech && detector.heardSpeech()) {
        heardSpeech = true;
        noSpeech.speechDetected();
      }
      if (decision === 'stop') {
        finished = true;
        handlersRef.current.onSpeechEnd();
      }
    });
    // 30초 상한 - 소리를 재고 있었는데 말이 한 번도 없었으면 보내지 않고 포기, 아니면(말했거나 잴 수 없었으면) 받아 적는다.
    const capTimer = setTimeout(() => {
      if (finished) return;
      finished = true;
      noSpeech.cancel();
      if (monitoring && !heardSpeech) handlersRef.current.onGiveUp();
      else handlersRef.current.onSpeechEnd();
    }, maxMs);
    return () => {
      unsubscribe();
      noSpeech.cancel();
      clearTimeout(capTimer);
    };
  }, [enabled, isRecording, maxMs, subscribeLevel]);

  return { reprompted };
}
