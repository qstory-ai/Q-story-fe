import type { NarrationRequest } from '@/features/narrate-story';
import { playResponseAudio, type ResponseAudio } from '@/features/route-question';
import { estimateNarrationDurationSeconds } from '@/entities/narration';

interface PlayResponseWithFallbackOptions {
  /** 이미 준비되어 있는 원격 오디오 - 없으면 곧바로 기기 TTS로 폴백한다. */
  remoteAudio: ResponseAudio | null;
  responseText: string;
  signal: AbortSignal;
  /** 오디오 재생(원격이든 폴백이든)이 실제로 시작된 첫 순간을 기록한다. */
  markFirstAudio: () => void;
  /** 원격 오디오 재생 중 진행률이 갱신될 때 호출된다. */
  onCaptionProgress: (progress: number) => void;
  /** 기기 TTS 폴백으로 전환하기 직전에 호출된다(자막 진행률 초기화 등). */
  onFallbackStart: () => void;
  speakNarration: (request: NarrationRequest) => Promise<void>;
  speakParams: NarrationRequest;
}

/**
 * 원격 오디오 재생을 시도하고, 실패하거나 준비되지 않았으면 기기 TTS로 폴백한다.
 * awaiting-choice/playing-response 두 내레이션 effect가 공유하던 로직을 추출했다.
 */
export async function playResponseWithFallback({
  remoteAudio,
  responseText,
  signal,
  markFirstAudio,
  onCaptionProgress,
  onFallbackStart,
  speakNarration,
  speakParams,
}: PlayResponseWithFallbackOptions): Promise<void> {
  const playedRemoteAudio = remoteAudio
    ? await playResponseAudio(
        remoteAudio,
        signal,
        markFirstAudio,
        onCaptionProgress,
        estimateNarrationDurationSeconds(responseText),
      )
    : false;
  if (!playedRemoteAudio) {
    markFirstAudio();
    onFallbackStart();
    await speakNarration(speakParams);
  }
}
