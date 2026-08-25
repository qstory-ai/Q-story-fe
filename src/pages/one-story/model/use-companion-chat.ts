import { useCallback, useMemo, useRef, useState } from 'react';

import {
  playResponseAudio,
  type BufferedResponseAudio,
} from '@/features/route-question';
import { useAudioRecorderAdapter } from '@/features/record-question';
import {
  sendCompanionChatMessage,
  transcribeCompanionChatAudio,
  CompanionChatError,
} from '@/entities/companion-chat';

import { pickRandomCompanionCharacter } from '../lib/companion-character';

export type CompanionChatTurn = {
  id: string;
  childText: string;
  replyText: string | null;
  status: 'sending' | 'done' | 'error';
  errorMessage?: string;
};

/**
 * 분기 상태 머신과 의도적으로 분리되어 있다 - 이것은 앵커에 종속되지 않는 자유 채팅이며,
 * route/plan/options 개념과는 무관하므로 (이미 약 1900줄인) use-one-story-runtime.ts에는
 * 속하지 않는다. 스토리 세션당 conversationId 하나를 사용하며, 아이가 입력한 원문 텍스트는
 * 답변을 생성하는 단 한 번의 요청 이외에는 이 훅 밖으로 나가지 않는다 - 상태에는 답변
 * 텍스트만 보관한다.
 */
export function useCompanionChat(params: { storyId: string; sceneId: string | null }) {
  const { storyId, sceneId } = params;
  const conversationIdRef = useRef<string>(crypto.randomUUID());
  const [character] = useState(pickRandomCompanionCharacter);
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<CompanionChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const recorder = useAudioRecorderAdapter();
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const transcribeAbortRef = useRef<AbortController | null>(null);

  const sending = useMemo(
    () => turns.some((turn) => turn.status === 'sending'),
    [turns],
  );

  const send = useCallback(
    async (childText: string) => {
      const text = childText.trim();
      if (!text || !sceneId || sending) {
        return;
      }
      const turnId = `${Date.now()}`;
      setTurns((prev) => [
        ...prev.slice(-9),
        { id: turnId, childText: text, replyText: null, status: 'sending' },
      ]);
      setDraft('');
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const reply = await sendCompanionChatMessage(
          {
            storyId,
            sceneId,
            conversationId: conversationIdRef.current,
            transcript: text,
          },
          controller.signal,
        );
        setTurns((prev) =>
          prev.map((turn) =>
            turn.id === turnId
              ? { ...turn, replyText: reply.responseText, status: 'done' }
              : turn,
          ),
        );
        if (reply.audio) {
          void playResponseAudio(
            reply.audio as BufferedResponseAudio,
            controller.signal,
          );
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setTurns((prev) =>
          prev.map((turn) =>
            turn.id === turnId
              ? {
                  ...turn,
                  status: 'error',
                  errorMessage:
                    error instanceof CompanionChatError
                      ? error.message
                      : '지금은 대답을 준비하지 못했어요.',
                }
              : turn,
          ),
        );
      }
    },
    [sceneId, sending, storyId],
  );

  const startVoiceInput = useCallback(async () => {
    setVoiceError(null);
    if (recorder.permissionState !== 'granted') {
      const granted = await recorder.requestPermission();
      if (!granted) {
        setVoiceError(recorder.error ?? '마이크를 사용할 수 없어요.');
        return;
      }
    }
    try {
      await recorder.startRecording();
    } catch {
      setVoiceError(recorder.error ?? '녹음을 시작하지 못했어요.');
    }
  }, [recorder]);

  const stopVoiceInput = useCallback(async () => {
    const recording = await recorder.stopRecording();
    if (!recording || !recording.uploadBlob || !sceneId) {
      setVoiceError('녹음 파일을 확인하지 못했어요.');
      return;
    }
    setTranscribing(true);
    const controller = new AbortController();
    transcribeAbortRef.current = controller;
    try {
      const transcript = await transcribeCompanionChatAudio(
        {
          storyId,
          sceneId,
          audioBlob: recording.uploadBlob,
          mimeType: recording.mimeType,
        },
        controller.signal,
      );
      setDraft(transcript.slice(0, 160));
    } catch (error) {
      if (controller.signal.aborted) return;
      setVoiceError(
        error instanceof CompanionChatError
          ? error.message
          : '이번에는 말소리를 문장으로 확인하지 못했어요.',
      );
    } finally {
      setTranscribing(false);
    }
  }, [recorder, sceneId, storyId]);

  const close = useCallback(() => {
    abortRef.current?.abort();
    transcribeAbortRef.current?.abort();
    if (recorder.isRecording) {
      void recorder.stopRecording();
    }
    setOpen(false);
  }, [recorder]);

  return {
    open,
    setOpen,
    close,
    character,
    turns,
    draft,
    setDraft,
    send,
    sending,
    recorder,
    voiceError,
    transcribing,
    startVoiceInput,
    stopVoiceInput,
  };
}

export type UseCompanionChat = ReturnType<typeof useCompanionChat>;
