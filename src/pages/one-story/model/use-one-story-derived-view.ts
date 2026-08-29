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
  width: number;
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
  width,
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
  const isCompactPlayback = width <= 430 && isPlaybackDockState;
  const spokenText = currentClip
    ? personalizeStoryText(currentClip.transcript, childName)
    : '';
  const captionClip = narrationState.captionRequestId
    ? (storyManifest.audioGroups
        .flatMap((group) => group.clips)
        .find((clip) => clip.id === narrationState.captionRequestId) ?? null)
    : null;
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
    isCompactPlayback,
    spokenText,
    captionSpeaker,
    displayedSubtitle,
    branchCaptionSpeaker,
    displayedBranchSubtitle,
    visualAssetId,
    illustration,
  };
}
