import type { FailureReason, StoryRuntimeState } from '@/entities/story-runtime';
import { personalizeStoryText } from '@/entities/narration';
import type { StoryRuntimePackage } from '@/entities/story';

export function formatDuration(durationMillis: number) {
  return `${Math.max(0, Math.ceil(durationMillis / 1000))}초`;
}

export function formatReportDuration(durationSeconds: number | null) {
  if (durationSeconds === null) {
    return '기록 중';
  }
  const minutes = Math.max(1, Math.round(durationSeconds / 60));
  return `${minutes}분`;
}

export function questionFailureCopy(failure: FailureReason) {
  const detail = failure.safeDetail?.trim();
  if (
    failure.stage === 'recording' ||
    failure.stage === 'normalization' ||
    failure.stage === 'stt'
  ) {
    return {
      eyebrow: '목소리를 다시 들려줘도 괜찮아요',
      title: '목소리를 문장으로 바꾸지 못했어요',
      help:
        detail ??
        '주변 소음을 줄이고 1초 이상 또렷하게 말하거나, 글로 질문해 주세요.',
    };
  }
  if (failure.stage === 'upload') {
    return {
      eyebrow: '연결을 다시 시도할 수 있어요',
      title: '질문 서버에 연결하지 못했어요',
      help:
        detail ??
        '인터넷 연결을 확인한 뒤 다시 보내거나, 잠시 후 글로 질문해 주세요.',
    };
  }
  if (failure.stage === 'routing' || failure.stage === 'response') {
    return {
      eyebrow: '질문의 뜻을 다시 확인할 수 있어요',
      title: 'AI가 질문의 뜻을 처리하지 못했어요',
      help:
        detail ??
        '같은 내용을 조금 다르게 말하거나 글로 적어 다시 보내 주세요.',
    };
  }
  return {
    eyebrow: '질문 방법을 다시 골라도 괜찮아요',
    title: '이번 질문을 처리하지 못했어요',
    help:
      detail ??
      '같은 장면에서 다시 말하거나 글로 적을 수 있어요. 질문 기회는 사용되지 않았어요.',
  };
}

export function getRuntimeClip(state: StoryRuntimeState, storyPackage: StoryRuntimePackage) {
  if (state.status !== 'playing-fixed') {
    return null;
  }
  const group = storyPackage.manifest.audioGroups.find(
    (candidate) => candidate.id === state.audioGroupId,
  );
  return group?.clips[state.clipIndex] ?? null;
}

export function getSceneIndex(state: StoryRuntimeState, storyPackage: StoryRuntimePackage) {
  if (!('sceneId' in state)) {
    return state.status === 'complete'
      ? storyPackage.presentation.scenes.length - 1
      : 0;
  }
  return Math.max(
    0,
    storyPackage.manifest.scenes.findIndex(
      (scene) => scene.id === state.sceneId,
    ),
  );
}

export function getAnchorVisualId(state: StoryRuntimeState, storyPackage: StoryRuntimePackage) {
  if (!('anchorId' in state) || !state.anchorId) {
    return null;
  }
  const anchor = storyPackage.manifest.questionAnchors.find(
    (candidate) => candidate.id === state.anchorId,
  );
  const group = anchor
    ? storyPackage.manifest.audioGroups.find(
        (candidate) => candidate.id === anchor.afterAudioGroupId,
      )
    : null;
  return group?.visualStateId ?? null;
}

export function getBranchFamily(state: StoryRuntimeState, storyPackage: StoryRuntimePackage) {
  if (state.status !== 'playing-response') {
    return null;
  }
  if (state.plan.kind === 'fallback') {
    return storyPackage.presentation.fallbackByFamilyId[state.plan.familyId];
  }
  if (state.plan.kind === 'story-change') {
    return storyPackage.presentation.fallbackByFamilyId[
      state.plan.fallbackFamilyId
    ];
  }
  if (state.plan.kind === 'route' && state.plan.actionFamilyId) {
    return storyPackage.presentation.fallbackByFamilyId[
      state.plan.actionFamilyId
    ];
  }
  return null;
}

export function getVisualAssetId({
  state,
  currentVisualId,
  branchVisualId,
  storyPackage,
}: {
  state: StoryRuntimeState;
  currentVisualId: string | null;
  branchVisualId: string | null;
  storyPackage: StoryRuntimePackage;
}) {
  if (branchVisualId && storyPackage.imageAssets[branchVisualId]) {
    return branchVisualId;
  }
  const visualId =
    branchVisualId ??
    currentVisualId ??
    getAnchorVisualId(state, storyPackage) ??
    storyPackage.presentation.scenes[getSceneIndex(state, storyPackage)]?.visuals[0]?.id;
  const visual = storyPackage.manifest.visualStates.find(
    (candidate) => candidate.id === visualId,
  );
  return (
    visual?.masterAssetId ??
    storyPackage.presentation.scenes[0].visuals[0].assetId
  );
}

export function statusCopy(state: StoryRuntimeState) {
  switch (state.status) {
    case 'idle':
      return '부모님과 함께 읽을 준비';
    case 'playing-fixed':
      return '이야기 듣는 중';
    case 'awaiting-question':
      return '아이의 궁금한 것을 기다리는 중';
    case 'recording-question':
      return '목소리 담는 중';
    case 'processing-question':
      return '이야기 속 답을 찾는 중';
    case 'awaiting-choice':
      return '세 가지 방법을 살펴보는 중';
    case 'awaiting-clarification':
      return '아이의 뜻을 한 번 더 확인하는 중';
    case 'playing-response':
      return '아이의 생각으로 달라진 순간';
    case 'rejoining':
      return '이야기로 돌아가는 중';
    case 'failed-recoverable':
      return '안전한 이야기 길을 찾는 중';
    case 'complete':
      return '오늘의 이야기 완주';
  }
}

export function questionPrompt(
  state: StoryRuntimeState,
  childName: string,
  storyPackage: StoryRuntimePackage,
) {
  if (state.status === 'awaiting-clarification') {
    return personalizeStoryText(state.prompt, childName);
  }
  if (!('anchorId' in state) || !state.anchorId) {
    return '';
  }
  const anchor = storyPackage.manifest.questionAnchors.find(
    (candidate) => candidate.id === state.anchorId,
  );
  return personalizeStoryText(
    anchor?.prompt ?? '무엇이 궁금해?',
    childName,
  );
}
