import type { StoryRuntimeState } from '@/entities/story-runtime';
import type { QuestionOutcome } from '@/entities/report';

type NarrationSnapshot = {
  isSpeaking: boolean;
  isPaused: boolean;
  source?: 'fixed' | 'device';
};

function currentFamilyId(state: StoryRuntimeState): string | null {
  return state.status === 'playing-response' ? state.plan.actionFamilyId : null;
}

function lastSelectedFamilyId(outcomes: readonly QuestionOutcome[]) {
  for (let index = outcomes.length - 1; index >= 0; index -= 1) {
    const outcome = outcomes[index];
    const familyId =
      outcome?.selectedOption?.actionFamilyId ?? outcome?.actionFamilyId;
    if (familyId) return familyId;
  }
  return null;
}

function audioState(
  state: StoryRuntimeState,
  narration: NarrationSnapshot,
) {
  if (narration.isPaused) return 'paused';
  if (narration.isSpeaking) return 'playing';
  if (state.status === 'generating-branch') return 'processing';
  return 'idle';
}

export function buildExitDiagnostics({
  state,
  questionOutcomes,
  clipId,
  narration,
}: {
  state: StoryRuntimeState;
  questionOutcomes: readonly QuestionOutcome[];
  clipId: string | null;
  narration: NarrationSnapshot;
}) {
  const sceneId =
    'sceneId' in state
      ? state.sceneId
      : state.status === 'complete'
        ? state.completedSceneId
        : null;
  const anchorId = 'anchorId' in state ? state.anchorId : null;
  const familyId =
    currentFamilyId(state) ?? lastSelectedFamilyId(questionOutcomes);

  return {
    runtime_status: state.status,
    audio_state: audioState(state, narration),
    ...(narration.source ? { audio_source: narration.source } : {}),
    ...(sceneId ? { scene_id: sceneId } : {}),
    ...(anchorId ? { anchor_id: anchorId } : {}),
    ...(familyId ? { family_id: familyId } : {}),
    ...(clipId ? { clip_id: clipId } : {}),
  };
}
