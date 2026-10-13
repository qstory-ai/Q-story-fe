import type { StoryRuntimePackage } from '@/entities/story';
import type { QuestionAnchor } from '@/entities/story-runtime';

/**
 * 질문 초대 대사(QUESTION_INVITE)의 클립 id - 앵커 바로 앞 묶음(afterAudioGroupId)에서 초대 역할인 클립.
 */
export function questionInviteClipId(
  storyPackage: Pick<StoryRuntimePackage, 'manifest' | 'presentation'>,
  anchor: Pick<QuestionAnchor, 'afterAudioGroupId'>,
): string | null {
  const group = storyPackage.manifest.audioGroups.find((candidate) => candidate.id === anchor.afterAudioGroupId);
  const clip = group?.clips.find((candidate) =>
    storyPackage.presentation.utteranceByClipId[candidate.id]?.role.startsWith('QUESTION_INVITE:'),
  );
  return clip?.id ?? null;
}

/**
 * 질문 초대를 실시간 TTS로 만들어야 하는지 - 미리 녹음한 고정 음성이 있으면 그걸 쓴다. 실시간으로 만들면 바로 앞뒤의 녹음한
 * 대사와 음량·말투가 달라 선택지 직전에 그레텔 목소리가 튀었고, 회차마다 TTS 하루 한도(100회)를 3번씩 썼다.
 */
export function inviteNeedsLiveNarration(
  storyPackage: Pick<StoryRuntimePackage, 'manifest' | 'presentation' | 'audioAssets'>,
  anchor: Pick<QuestionAnchor, 'afterAudioGroupId'>,
): boolean {
  const clipId = questionInviteClipId(storyPackage, anchor);
  return !clipId || !storyPackage.audioAssets[clipId]?.uri;
}
