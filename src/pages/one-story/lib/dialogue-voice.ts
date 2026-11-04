import { envSwitch } from '@/shared/config';

/**
 * 그레텔 "생각 중" 채움말 고르기와 그 스위치. 답 음성은 늘 스트리밍(답 문장이 오는 즉시 말풍선을 띄우고 같은 문장의 음성을
 * POST /v1/narrations/stream으로 받아 첫 조각부터 재생)이다 - 서버 쪽 스위치는 GEMINI_TTS_STREAMING·COMPANION_REPLY_STREAMING
 * (be application.yml qstory.voice-streaming).
 */

/** 아이가 말을 보낸 뒤 FILLER_DELAY_MS 안에 답 문장이 안 오면 미리 녹음한 채움말을 먼저 들려준다. VITE_QSTORY_DIALOGUE_THINKING_FILLER=false로 끈다. */
export const DIALOGUE_THINKING_FILLER = envSwitch('VITE_QSTORY_DIALOGUE_THINKING_FILLER');

/** 이 안에 답 문장이 오면 채움말을 건너뛴다. */
export const FILLER_DELAY_MS = 1_000;

/** story.yaml thinkingFillers의 i번째(0부터) 녹음 id - assets.json의 slug와 같다. */
export function thinkingFillerClipId(index: number) {
  return `dialogue-thinking-${index + 1}`;
}

/**
 * 채움말 하나를 고른다 - 바로 앞에 쓴 것은 피해 같은 말이 연달아 나오지 않게 한다. 채움말이 없으면 null.
 * random은 [0, 1) - 테스트에서 고정한다.
 */
export function pickThinkingFiller(
  count: number,
  previousIndex: number | null,
  random: () => number = Math.random,
): number | null {
  if (count <= 0) return null;
  if (count === 1) return 0;
  const candidates = Array.from({ length: count }, (_, index) => index).filter((index) => index !== previousIndex);
  return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
}

/** 답 첫 소리와 겹칠 때 채움말을 줄여 끄는 시간(초) - 툭 끊기지 않을 만큼만. */
export const FILLER_FADE_SECONDS = 0.12;

/** 채움말 재생 시각(오디오 시계, 초). startAt이 null이면 아직 소리를 내지 않았다(기다리는 중·준비 중). */
export type FillerTiming = { startAt: number | null; endAt: number | null };

/**
 * 답 음성의 첫 소리 시각이 정해졌을 때 채움말을 어떻게 할지 - 답은 절대 기다리게 하지 않는다.
 * - skip: 채움말이 아직 소리를 내기 전이다 - 시작하지 않는다(예약만 됐으면 멈춘다).
 * - keep: 채움말이 답 첫 소리 전에(또는 줄여 끄는 사이에) 저절로 끝난다 - 그대로 둔다.
 * - fade: from부터 to까지 줄여 끈다. 가능하면 답 첫 소리 전에 다 줄이고, 시간이 모자라면 지금부터 줄인다(짧게 겹친다).
 */
export type FillerCut = { kind: 'skip' } | { kind: 'keep' } | { kind: 'fade'; from: number; to: number };

export function planFillerCut(
  filler: FillerTiming,
  replyStartAt: number,
  now: number,
  fadeSeconds: number = FILLER_FADE_SECONDS,
): FillerCut {
  if (filler.startAt === null || filler.startAt >= replyStartAt) return { kind: 'skip' };
  const from = Math.max(now, replyStartAt - fadeSeconds);
  if (filler.endAt !== null && filler.endAt <= from + fadeSeconds) return { kind: 'keep' };
  return { kind: 'fade', from, to: from + fadeSeconds };
}
