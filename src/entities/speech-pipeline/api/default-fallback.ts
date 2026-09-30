import type { StoryRuntimePackage } from '@/entities/story';

import type { SpeechPipelineInput } from './types';

/** 질문 앵커의 기본 fallback family - 서버 응답 없이도 준비된 안전 장면으로 이어 가기 위해 쓴다. */
export function defaultFallbackFamilyFor(
  storyPackage: StoryRuntimePackage,
  input: Pick<SpeechPipelineInput, 'storyId' | 'sceneId' | 'anchorId'>,
) {
  const anchor = storyPackage.manifest.questionAnchors.find(
    (candidate) =>
      candidate.id === input.anchorId && candidate.sceneId === input.sceneId,
  );
  const fallback = anchor
    ? storyPackage.manifest.fallbackFamilies.find(
        (candidate) => candidate.id === anchor.defaultFallbackFamilyId,
      )
    : null;
  if (!fallback) {
    throw new Error(
      `No package fallback for ${input.storyId}/${input.sceneId}/${input.anchorId}`,
    );
  }
  return fallback;
}
