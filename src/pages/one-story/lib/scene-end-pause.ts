import {
  transitionStoryRuntime,
  type AudioClipId,
  type StoryManifest,
  type StoryRuntimeState,
} from '@/entities/story-runtime';

/** 장면 끝에서 다음 장면으로 넘어가기 전에 쉬는 시간(3초, PM 요청 "3초 뒤 다음 챕터") - 아이가 그레텔에게 물어볼 틈. */
export const SCENE_END_PAUSE_MS = 3_000;

/** 장면 끝 쉼에서 그레텔이 건네는 말 - 장면마다 돌아가며 바꿔 같은 말이 매번 반복되지 않게 한다(PM 요청). */
export const SCENE_END_PROMPTS = ['여기까지 궁금한 거 있어?', '나한테 물어볼 거 있어?', '말할 거 있어?'] as const;

export function sceneEndPrompt(sceneIndex: number): string {
  const count = SCENE_END_PROMPTS.length;
  const index = Number.isFinite(sceneIndex) ? ((Math.trunc(sceneIndex) % count) + count) % count : 0;
  return SCENE_END_PROMPTS[index];
}

/**
 * 이 대사가 끝나면 다음 장면의 고정 낭독으로 바로 넘어가는지(= 장면 끝 쉼을 둘 자리인지).
 * 같은 장면 안의 다음 대사, 질문 초대, 완주로 가는 경우는 쉬지 않는다.
 */
export function isSceneEndClip(
  manifest: StoryManifest,
  state: StoryRuntimeState,
  clipId: AudioClipId,
): boolean {
  if (state.status !== 'playing-fixed') return false;
  const next = transitionStoryRuntime(manifest, state, { type: 'AUDIO_ENDED', clipId });
  return next.ok && next.state.status === 'playing-fixed' && next.state.sceneId !== state.sceneId;
}

/**
 * 그레텔 대화를 닫고 이야기로 돌아갈 때 할 일.
 * - advance: 장면 끝에서 쉬던 중이었다 - 다음 장면으로 넘어간다.
 * - replay: 낭독 중에 대화를 열었다 - 멈춘 문장을 처음부터 다시 들려준다(대화가 낭독을 끊어 두었다).
 * - none: 이어 갈 낭독이 없다(질문 초대·선택 대기 등은 그 화면이 이어 받는다).
 */
export type DialogueResumePlan = 'advance' | 'replay' | 'none';

export function dialogueResumePlan(input: {
  sceneEndPending: boolean;
  status: StoryRuntimeState['status'];
}): DialogueResumePlan {
  if (input.status === 'playing-fixed' && input.sceneEndPending) return 'advance';
  if (input.status === 'playing-fixed' || input.status === 'playing-response') return 'replay';
  return 'none';
}
