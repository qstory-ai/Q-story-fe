import type { StoryRuntimeState } from '@/entities/story-runtime';

export type QuestionSkipReason =
  | 'continue_listening'
  | 'clarification_continue'
  | 'safety_retry_continue'
  | 'no_speech_timeout';

/**
 * 이야기가 아직 이 앵커의 질문 초대(awaiting-question)를 기다리는지(Q-34). 늦게 끝난 대화 닫기·무응답 포기가
 * 이미 다른 상태(행동 실행, 다음 장면, 처음부터 다시)로 넘어간 이야기를 다시 넘기지 않게 막는다.
 */
export function isAwaitingInviteFor(state: StoryRuntimeState, anchorId: string | null) {
  return anchorId !== null && state.status === 'awaiting-question' && state.anchorId === anchorId;
}

/** 질문을 건너뛰고 이야기를 이어 갈 때 남기는 question_skipped 메타데이터. 질문 상태가 아니면 null. */
export function questionSkipMetadata(
  state: StoryRuntimeState,
  reasonOverride?: QuestionSkipReason,
): { anchor_id: string; scene_id: string; skip_reason: QuestionSkipReason } | null {
  if (
    state.status !== 'awaiting-question' &&
    state.status !== 'awaiting-clarification' &&
    state.status !== 'awaiting-safety-retry'
  ) {
    return null;
  }
  return {
    anchor_id: state.anchorId,
    scene_id: state.sceneId,
    skip_reason:
      reasonOverride ??
      (state.status === 'awaiting-clarification'
        ? 'clarification_continue'
        : state.status === 'awaiting-safety-retry'
          ? 'safety_retry_continue'
          : 'continue_listening'),
  };
}
