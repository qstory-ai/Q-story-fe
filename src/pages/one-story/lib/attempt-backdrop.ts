import type { ImageSource } from '@/entities/story';

/**
 * 질문 초대 시도 장면(TRY_FAIL)의 배경 연출. 막힌 줄(보통 시도 장면 3번째 줄)을 읽는 순간 배경을 그 막힌 모습의 그림으로
 * 크로스페이드하고, 맞는 그림이 없으면 지금 그림을 살짝 확대·어둡게 한다. 시도 장면이 끝나면(ATTEMPT_END·대화 닫기·이야기로
 * 돌아가기·장면 이동) 원래 그림으로 돌아온다.
 *
 * - assetId: 서버가 고른 그림 id(요청에 실은 후보 중 하나). null이면 그림 없이 지금 그림으로 연출한다.
 * - uri: 서버가 아이 말대로 실시간으로 만든 그림(GET /v1/realtime-images/{id}가 READY를 주면). 있으면 assetId보다 먼저 쓴다.
 * - key: 세운 때의 질문 지점(장면·앵커). 이야기가 그 질문 지점을 벗어나면 저절로 풀린다(attemptBackdropView).
 */
export type AttemptBackdropState = { assetId: string | null; uri?: string; key: string };

/** 실시간으로 만든 그림의 자리표시 id - 자산 목록에는 없고, 뷰의 assetId로만 쓴다(그림 바뀜 감지용). */
export const REALTIME_BACKDROP_ASSET_ID = 'realtime-attempt-backdrop';

/** 배경이 지금 보여 줄 것 - 없음 / 시도 장면 그림 / 지금 그림 강조(확대·어둡게). */
export type AttemptBackdropView =
  | { kind: 'none' }
  | { kind: 'image'; assetId: string; image: ImageSource }
  | { kind: 'emphasis' };

export const NO_ATTEMPT_BACKDROP: AttemptBackdropView = { kind: 'none' };

/** 시도 장면 배경이 묶이는 질문 지점 - 질문 초대를 기다리는 동안만 있다(다른 상태면 null = 배경을 세우지 않는다). */
export function attemptBackdropKey(
  status: string,
  sceneIndex: number,
  anchorId: string | null | undefined,
): string | null {
  return status === 'awaiting-question' && anchorId ? `${sceneIndex}:${anchorId}` : null;
}

/**
 * 지금 그릴 시도 장면 배경. 세운 질문 지점을 벗어났으면(이야기 재개·장면 이동·처음부터 다시) 없음. 그림 id가 없거나 그 그림이
 * 이 이야기 자산에 없으면(아직 올리지 않은 그림, 목록 밖 id) 지금 그림 강조로 대신한다.
 */
export function attemptBackdropView(
  state: AttemptBackdropState | null,
  currentKey: string | null,
  imageAssets: Readonly<Record<string, ImageSource>>,
): AttemptBackdropView {
  if (!state || !currentKey || state.key !== currentKey) return NO_ATTEMPT_BACKDROP;
  if (state.uri) {
    return { kind: 'image', assetId: `${REALTIME_BACKDROP_ASSET_ID}:${state.uri}`, image: { uri: state.uri } };
  }
  const image = state.assetId ? imageAssets[state.assetId] : undefined;
  return state.assetId && image ? { kind: 'image', assetId: state.assetId, image } : { kind: 'emphasis' };
}

/**
 * 배경을 바꿀 줄 - 마지막 내레이터 줄(막힌 결과를 말하는 줄, 보통 3번째). 내레이터 줄이 없으면 마지막 줄, 줄이 없으면 -1.
 */
export function blockedLineIndex(
  scene: readonly { speakerId: string }[],
  narratorSpeakerId: string,
): number {
  for (let index = scene.length - 1; index >= 0; index -= 1) {
    if (scene[index]?.speakerId === narratorSpeakerId) return index;
  }
  return scene.length - 1;
}

/** 크로스페이드·강조 시간(ms). 강조는 천천히 들어가고, 풀 때는 크로스페이드와 같은 빠르기로 돌아온다. */
export const BACKDROP_FADE_MS = 600;
export const BACKDROP_EMPHASIS_IN_MS = 2400;
export const BACKDROP_EMPHASIS_SCALE = 1.06;
export const BACKDROP_EMPHASIS_DIM = 0.28;

/**
 * 배경 애니메이션 목표값. overlay = 시도 장면 그림 불투명도(0~1), emphasis = 지금 그림 강조 정도(0~1, 확대·어둡게).
 * 움직임 줄이기 설정이면 시간을 0으로(바로 바뀜) 하고 확대하지 않는다 - 그림 바꾸기와 어둡게 하기는 그대로 보여 준다.
 */
export function backdropMotion(
  view: AttemptBackdropView,
  reduceMotion: boolean,
): {
  overlay: number;
  overlayMs: number;
  emphasis: number;
  emphasisMs: number;
  scale: number;
} {
  const emphasis = view.kind === 'emphasis' ? 1 : 0;
  return {
    overlay: view.kind === 'image' ? 1 : 0,
    overlayMs: reduceMotion ? 0 : BACKDROP_FADE_MS,
    emphasis,
    emphasisMs: reduceMotion ? 0 : emphasis ? BACKDROP_EMPHASIS_IN_MS : BACKDROP_FADE_MS,
    scale: reduceMotion ? 1 : BACKDROP_EMPHASIS_SCALE,
  };
}
