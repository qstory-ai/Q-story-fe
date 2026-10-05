import type { StoryRuntimeState } from '@/entities/story-runtime';

import type { QuestionOutcome } from './parent-report';

const STORAGE_KEY = 'qstory.hg.progress.v1';

type StorageLike = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

export type LocalStoryProgress = {
  version: 1;
  savedAt: string;
  state: StoryRuntimeState;
  storyId: string;
  childName: string;
  /**
   * 보호자 세션에서 이 진행을 남긴 아이 프로필 id. 저장소에는 기기당 한 건만 남으므로, 이어서 읽기가
   * 지금 선택된 아이가 아니라 이 아이로 재생·기록되게 하는 기준이다. 이 필드가 생기기 전 기록과
   * 데모·선생님 세션에는 없다.
   */
  childId?: string;
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
  if (state.status === 'idle') {
    return null;
  }
  if (
    state.status === 'recording-question' ||
    state.status === 'processing-question' ||
    state.status === 'generating-branch' ||
    state.status === 'failed-recoverable' ||
    state.status === 'awaiting-safety-retry'
  ) {
    if (!state.anchorId || !state.questionRound) {
      return null;
    }
    return {
      status: 'awaiting-question',
      sceneId: state.sceneId,
      anchorId: state.anchorId,
      questionRound: state.questionRound,
      // 재개는 항상 이 앵커에 대한 새 질문 시도로 취급한다 - 재질문/실패 도중의 안전게이트
      // 카운터를 그대로 들고 재개할 안전한 방법이 없으므로 0으로 리셋한다.
      consecutiveSafetyFailures: 0,
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
    storyId: input.storyId,
    childName: input.childName.trim().slice(0, 10),
    ...(input.childId ? { childId: input.childId } : {}),
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
      typeof value.storyId !== 'string' ||
      typeof value.childName !== 'string' ||
      (value.childId !== undefined && typeof value.childId !== 'string') ||
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
    // 진행 상황 저장이 스토리 재생을 절대 막아서는 안 된다.
  }
}

export const localStoryProgressStorageKey = STORAGE_KEY;

/**
 * 저장된 진행 기록이 지금 연 이야기의 것일 때만 이어듣기 후보로 쓴다 - 저장소에는 한 건만 남는다.
 * childId를 넘기면 다른 아이가 남긴 기록(childId가 저장된 경우)도 후보에서 뺀다 - 형제 계정에서
 * 다른 아이의 진행을 이어 받아 그 아이 이름으로 듣고 지금 아이 리포트로 저장되는 걸 막는다.
 */
export function resumableProgressFor(
  progress: LocalStoryProgress | null,
  storyId: string,
  childId?: string | null,
): LocalStoryProgress | null {
  if (!progress || progress.storyId !== storyId) return null;
  if (childId && progress.childId && progress.childId !== childId) return null;
  return progress;
}
