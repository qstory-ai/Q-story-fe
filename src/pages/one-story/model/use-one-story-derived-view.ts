import { useMemo } from 'react';

import {
  buildCaptionTrack,
  captionCueAtProgress,
  personalizeStoryText,
} from '@/entities/narration';
import type { StoryRuntimeState } from '@/entities/story-runtime';
import type { StoryRuntimePackage } from '@/entities/story';
import type { LocalStoryProgress } from '@/entities/analytics';
import type { useStoryNarration } from '@/features/narrate-story';

import {
  getBranchFamily,
  getRuntimeClip,
  getSceneIndex as getSceneIndexForPackage,
  getVisualAssetId,
} from '../lib/runtime-view';
import {
  attemptBackdropKey,
  attemptBackdropView,
  type AttemptBackdropState,
} from '../lib/attempt-backdrop';

interface BranchCaption {
  text: string;
  speakerId: string;
  progress: number | null;
}

interface UseOneStoryDerivedViewParams {
  runtimeState: StoryRuntimeState;
  storyPackage: StoryRuntimePackage;
  narrationState: ReturnType<typeof useStoryNarration>['state'];
  childName: string;
  activeBranchVisualId: string | null;
  branchCaption: BranchCaption | null;
  resumeCandidate: LocalStoryProgress | null;
  /** 질문 초대 시도 장면 배경(그레텔 대화가 막힌 줄에서 세운다) - 없으면 null. */
  attemptBackdrop?: AttemptBackdropState | null;
}

/**
 * use-one-story-runtime의 순수 파생 view 상태(현재 클립/화자/자막/삽화 등)를 계산한다.
 * 상태를 소유하지 않고 부수효과도 없다 - 매 렌더마다 runtimeState 등으로부터 다시 계산된다.
 */
export function useOneStoryDerivedView({
  runtimeState,
  storyPackage,
  narrationState,
  childName,
  activeBranchVisualId,
  branchCaption,
  resumeCandidate,
  attemptBackdrop = null,
}: UseOneStoryDerivedViewParams) {
  const storyManifest = storyPackage.manifest;
  const storyPresentation = storyPackage.presentation;

  const currentClip = getRuntimeClip(runtimeState, storyPackage);
  const currentPresentation = currentClip
    ? storyPresentation.utteranceByClipId[currentClip.id]
    : null;
  const sceneIndex = getSceneIndexForPackage(runtimeState, storyPackage);
  const displayedSceneIndex =
    runtimeState.status === 'idle' && resumeCandidate
      ? getSceneIndexForPackage(resumeCandidate.state, storyPackage)
      : sceneIndex;
  const scene = storyPresentation.scenes[sceneIndex];
  const speaker = currentClip
    ? storyManifest.speakers.find(
        (candidate) => candidate.id === currentClip.speakerId,
      )
    : null;
  const questionInviteAnchor =
    runtimeState.status === 'playing-fixed' &&
    currentPresentation?.role.startsWith('QUESTION_INVITE:')
      ? (storyManifest.questionAnchors.find(
          (anchor) => anchor.afterAudioGroupId === runtimeState.audioGroupId,
        ) ?? null)
      : null;
  const activeQuestionAnchor =
    questionInviteAnchor ??
    ('anchorId' in runtimeState
      ? (storyManifest.questionAnchors.find(
          (anchor) => anchor.id === runtimeState.anchorId,
        ) ?? null)
      : null);
  const isQuestionInvitePlayback = questionInviteAnchor !== null;
  const branch = getBranchFamily(runtimeState, storyPackage);
  const isBranchPlaybackState =
    runtimeState.status === 'playing-response' && branch !== null;
  const isPlaybackDockState =
    (runtimeState.status === 'playing-fixed' && !isQuestionInvitePlayback) ||
    isBranchPlaybackState;
  const spokenText = currentClip
    ? personalizeStoryText(currentClip.transcript, childName)
    : '';
  // 재생 진행률이 갱신될 때마다 다시 렌더되므로 전체 클립 탐색은 captionRequestId가 바뀔 때만 한다.
  const captionRequestId = narrationState.captionRequestId;
  const captionClip = useMemo(
    () =>
      captionRequestId
        ? (storyManifest.audioGroups
            .flatMap((group) => group.clips)
            .find((clip) => clip.id === captionRequestId) ?? null)
        : null,
    [captionRequestId, storyManifest.audioGroups],
  );
  const captionSpeaker = captionClip
    ? storyManifest.speakers.find(
        (candidate) => candidate.id === captionClip.speakerId,
      )
    : null;
  const captionText = captionClip
    ? personalizeStoryText(captionClip.transcript, childName)
    : '';
  const activeCaptionTrack = useMemo(
    () => buildCaptionTrack(captionText),
    [captionText],
  );
  const displayedSubtitle = captionCueAtProgress(
    activeCaptionTrack,
    narrationState.progress,
  );
  const branchCaptionSpeaker = branchCaption
    ? storyManifest.speakers.find(
        (candidate) => candidate.id === branchCaption.speakerId,
      )
    : null;
  const activeBranchCaptionTrack = useMemo(
    () => buildCaptionTrack(branchCaption?.text ?? ''),
    [branchCaption?.text],
  );
  const displayedBranchSubtitle = captionCueAtProgress(
    activeBranchCaptionTrack,
    branchCaption?.progress ?? narrationState.progress,
  );
  const plannedBranchFamilyId =
    runtimeState.status !== 'playing-response'
      ? null
      : runtimeState.plan.kind === 'route'
        ? runtimeState.plan.actionFamilyId
        : runtimeState.plan.kind === 'story-change'
          ? runtimeState.plan.fallbackFamilyId
          : runtimeState.plan.kind === 'fallback'
            ? runtimeState.plan.familyId
            : null;
  const plannedBranchAssetId = storyPackage.branchIllustrationAssetId(
    plannedBranchFamilyId,
  );
  const visualAssetId = getVisualAssetId({
    state: runtimeState,
    currentVisualId: currentPresentation?.visualId ?? null,
    branchVisualId: activeBranchVisualId ?? plannedBranchAssetId,
    storyPackage,
  });
  const illustration = storyPackage.illustrationForAssetId(visualAssetId);
  // 그림 우선순위 맨 앞 - 시도 장면 배경. 질문 초대를 벗어나면(이야기 재개·장면 이동) 저절로 풀린다. 배경 화면은 지금 그림
  // (illustration) 위에 이 그림을 겹쳐 크로스페이드하고, 그림이 없으면 지금 그림을 강조한다.
  const attemptBackdropAt = attemptBackdropKey(
    runtimeState.status,
    sceneIndex,
    'anchorId' in runtimeState ? runtimeState.anchorId : null,
  );
  const attemptBackdropShown = attemptBackdropView(
    attemptBackdrop,
    attemptBackdropAt,
    storyPackage.imageAssets,
  );

  return {
    currentClip,
    sceneIndex,
    displayedSceneIndex,
    scene,
    speaker,
    questionInviteAnchor,
    activeQuestionAnchor,
    isQuestionInvitePlayback,
    isBranchPlaybackState,
    isPlaybackDockState,
    spokenText,
    captionSpeaker,
    displayedSubtitle,
    branchCaptionSpeaker,
    displayedBranchSubtitle,
    illustration,
    visualAssetId,
    attemptBackdropAt,
    attemptBackdropShown,
  };
}
