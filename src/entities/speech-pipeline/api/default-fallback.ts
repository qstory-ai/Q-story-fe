import type { StoryRuntimePackage } from '@/entities/story';

import type { SpeechPipelineInput } from './types';

/**
 * 질문 앵커의 기본 fallback family - 서버 응답 없이도 준비된 안전 장면으로 이어 가기 위해 쓴다.
 * 기본 분기를 두지 않은 질문 지점(대화만 하는 지점 등)은 null - 호출부는 기본 이야기로 이어 간다.
 */
export function defaultFallbackFamilyFor(
  storyPackage: StoryRuntimePackage,
  input: Pick<SpeechPipelineInput, 'storyId' | 'sceneId' | 'anchorId'>,
) {
  const anchor = storyPackage.manifest.questionAnchors.find(
    (candidate) =>
      candidate.id === input.anchorId && candidate.sceneId === input.sceneId,
  );
  if (!anchor) {
    throw new Error(
      `No question anchor for ${input.storyId}/${input.sceneId}/${input.anchorId}`,
    );
  }
  if (anchor.defaultFallbackFamilyId === null) return null;
  const fallback = storyPackage.manifest.fallbackFamilies.find(
    (candidate) => candidate.id === anchor.defaultFallbackFamilyId,
  );
  if (!fallback) {
    throw new Error(
      `No package fallback for ${input.storyId}/${input.sceneId}/${input.anchorId}`,
    );
  }
  return fallback;
}
