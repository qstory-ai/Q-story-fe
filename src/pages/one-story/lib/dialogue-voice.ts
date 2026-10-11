/**
 * 그레텔 답 음성을 빨리 들려주기 위한 스위치와 "생각 중" 채움말 고르기.
 * 소리 품질·한도(Gemini TTS 하루 요청 수)에 문제가 생기면 여기 상수를 false로 바꿔 바로 끈다 - 서버 쪽 스위치는
 * GEMINI_TTS_STREAMING·COMPANION_REPLY_STREAMING(be application.yml qstory.voice-streaming).
 */

/**
 * true: 답 문장이 오는 즉시(NDJSON 첫 줄) 말풍선을 띄우고 같은 문장의 음성을 POST /v1/narrations/stream으로 받아
 * 첫 조각부터 재생한다. false: 예전처럼 답 전체를 받은 뒤 음성 전체(POST /v1/narrations)를 받아 재생한다.
 * 어느 쪽이든 TTS 호출은 답 하나에 한 번이다.
 */
export const DIALOGUE_VOICE_STREAMING = true;

/** true: 아이가 말을 보낸 뒤 FILLER_DELAY_MS 안에 답 문장이 안 오면 미리 녹음한 채움말을 먼저 들려준다. */
export const DIALOGUE_THINKING_FILLER = true;

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
