import type { StoryRuntimeState } from '@/entities/story-runtime';

import type { QuestionOutcome } from './parent-report';

const STORAGE_KEY = 'qstory.hg.progress.v1';

type StorageLike = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

export type LocalStoryProgress = {
  version: 1;
  savedAt: string;
  state: StoryRuntimeState;
  childName: string;
  elapsedSeconds: number;
  questionOutcomes: QuestionOutcome[];
};

function browserStorage(): StorageLike | null {
  try {
    return typeof globalThis.localStorage === 'undefined'
      ? null
      : globalThis.localStorage;
  } catch {
    return null;
  }
}

function isRuntimeState(value: unknown): value is StoryRuntimeState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const status = (value as { status?: unknown }).status;
  return (
    typeof status === 'string' &&
    [
      'playing-fixed',
      'awaiting-question',
      'awaiting-choice',
      'awaiting-clarification',
      'playing-response',
      'complete',
    ].includes(status)
  );
}

export function resumableRuntimeState(
  state: StoryRuntimeState,
): StoryRuntimeState | null {
  if (state.status === 'idle' || state.status === 'rejoining') {
    return null;
  }
  if (
    state.status === 'recording-question' ||
    state.status === 'processing-question' ||
    state.status === 'failed-recoverable'
  ) {
    if (!state.anchorId || !state.questionRound) {
      return null;
    }
    return {
      status: 'awaiting-question',
      sceneId: state.sceneId,
      anchorId: state.anchorId,
      questionRound: state.questionRound,
    };
  }
  return state;
}

export function saveLocalStoryProgress(
  input: Omit<LocalStoryProgress, 'version' | 'savedAt' | 'state'> & {
    state: StoryRuntimeState;
  },
  storage: StorageLike | null = browserStorage(),
) {
  const state = resumableRuntimeState(input.state);
  if (!storage || !state) {
    return false;
  }
  const payload: LocalStoryProgress = {
    version: 1,
    savedAt: new Date().toISOString(),
    state,
    childName: input.childName.trim().slice(0, 10),
    elapsedSeconds: Math.max(0, Math.round(input.elapsedSeconds)),
    questionOutcomes: input.questionOutcomes,
  };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function loadLocalStoryProgress(
  storage: StorageLike | null = browserStorage(),
): LocalStoryProgress | null {
  if (!storage) {
    return null;
  }
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const value = JSON.parse(raw) as Partial<LocalStoryProgress>;
    if (
      value.version !== 1 ||
      typeof value.savedAt !== 'string' ||
      !isRuntimeState(value.state) ||
      typeof value.childName !== 'string' ||
      typeof value.elapsedSeconds !== 'number' ||
      !Array.isArray(value.questionOutcomes)
    ) {
      storage.removeItem(STORAGE_KEY);
      return null;
    }
    return value as LocalStoryProgress;
  } catch {
    storage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearLocalStoryProgress(
  storage: StorageLike | null = browserStorage(),
) {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // Progress storage must never block story playback.
  }
}

export const localStoryProgressStorageKey = STORAGE_KEY;
