import type { StoryRuntimeState } from '@/entities/story-runtime';
import type { QuestionOutcome } from './parent-report';

type NarrationSnapshot = {
  isSpeaking: boolean;
  isPaused: boolean;
  source?: 'fixed' | 'device';
};

function currentFamilyId(state: StoryRuntimeState): string | null {
  if (state.status !== 'playing-response') return null;
  if (state.plan.kind === 'fallback') return state.plan.familyId;
  if (state.plan.kind === 'story-change') return state.plan.fallbackFamilyId;
  if (state.plan.kind === 'route') return state.plan.actionFamilyId;
  return null;
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
  if (state.status === 'recording-question') return 'recording';
  if (state.status === 'processing-question') return 'processing';
  if (state.status === 'failed-recoverable') return 'failed';
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
    ...(state.status === 'failed-recoverable'
      ? { failure_code: state.failure.code }
      : {}),
  };
}
