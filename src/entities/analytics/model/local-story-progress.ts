import type { StoryRuntimeState } from '@/entities/story-runtime';

import type { QuestionOutcome } from './parent-report';

const STORAGE_KEY = 'qstory.hg.progress.v1';

/** 계정별 저장 키. 비로그인(데모)은 예전 키를 그대로 쓴다 - 로그인 때 그 기록을 한 번 읽어 계정으로 옮기거나 동기화한다. */
export function progressStorageKey(userId?: string | null): string {
  return userId ? `${STORAGE_KEY}.${userId}` : STORAGE_KEY;
}

let progressOwnerId: string | null = null;

/** 지금 로그인한 사용자 id(없으면 null). AuthProvider가 인증 상태가 바뀌기 직전에 갱신한다. */
export function setLocalProgressOwner(userId: string | null) {
  progressOwnerId = userId;
}

export function getLocalProgressOwner(): string | null {
  return progressOwnerId;
}

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
  /**
   * 이 진행의 회차 id(conversationId)와 다음 대화 줄 번호(Q-39). 이어서 읽으면 같은 회차로 대화 기록과
   * 리포트가 이어진다 - 이 필드가 생기기 전 기록에는 없고, 그때는 새 회차로 시작한다.
   */
  sessionId?: string;
  nextTurnSeq?: number;
  /** 이 회차에서 처음 읽은 장면과 가장 멀리 읽은 장면 - 리포트의 "읽은 범위". */
  readFromSceneId?: string;
  readThroughSceneId?: string;
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
  key: string = progressStorageKey(progressOwnerId),
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
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    ...(typeof input.nextTurnSeq === 'number' ? { nextTurnSeq: Math.max(1, Math.floor(input.nextTurnSeq)) } : {}),
    ...(input.readFromSceneId ? { readFromSceneId: input.readFromSceneId } : {}),
    ...(input.readThroughSceneId ? { readThroughSceneId: input.readThroughSceneId } : {}),
  };
  try {
    storage.setItem(key, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function loadLocalStoryProgress(
  storage: StorageLike | null = browserStorage(),
  key: string = progressStorageKey(progressOwnerId),
): LocalStoryProgress | null {
  if (!storage) {
    return null;
  }
  try {
    const raw = storage.getItem(key);
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
      !Array.isArray(value.questionOutcomes) ||
      (value.sessionId !== undefined && typeof value.sessionId !== 'string') ||
      (value.nextTurnSeq !== undefined && typeof value.nextTurnSeq !== 'number')
    ) {
      storage.removeItem(key);
      return null;
    }
    return value as LocalStoryProgress;
  } catch {
    storage.removeItem(key);
    return null;
  }
}

export function clearLocalStoryProgress(
  storage: StorageLike | null = browserStorage(),
  key: string = progressStorageKey(progressOwnerId),
) {
  try {
    storage?.removeItem(key);
  } catch {
    // 진행 상황 저장이 스토리 재생을 절대 막아서는 안 된다.
  }
}

export const localStoryProgressStorageKey = STORAGE_KEY;

/** 비로그인(데모) 키의 기록 - 가입·로그인 직후 계정으로 동기화할 때만 읽는다. */
export function loadAnonymousLocalStoryProgress(storage: StorageLike | null = browserStorage()) {
  return loadLocalStoryProgress(storage, progressStorageKey(null));
}

export function clearAnonymousLocalStoryProgress(storage: StorageLike | null = browserStorage()) {
  clearLocalStoryProgress(storage, progressStorageKey(null));
}

export type LegacyProgressDecision = 'move' | 'discard' | 'keep';

/**
 * 로그인 사용자의 예전(공용 키) 기록을 어떻게 할지. 완주 상태나 기록 없음은 건드리지 않는다(데모 동기화가 읽는다).
 * 진행 중이면 그 childId가 이 계정의 아이일 때만 계정 키로 옮기고, 아니면(다른 계정의 기록·아이 없음) 버린다.
 */
export function decideLegacyProgressMigration(
  legacy: LocalStoryProgress | null,
  childIds: readonly string[],
): LegacyProgressDecision {
  if (!legacy || legacy.state.status === 'complete') return 'keep';
  return legacy.childId && childIds.includes(legacy.childId) ? 'move' : 'discard';
}

/** 예전 키 기록을 판단대로 처리한다. 계정 키에 이미 기록이 있으면 덮어쓰지 않는다. */
export function migrateLegacyProgress(
  userId: string,
  childIds: readonly string[],
  storage: StorageLike | null = browserStorage(),
): LegacyProgressDecision {
  const legacyKey = progressStorageKey(null);
  const decision = decideLegacyProgressMigration(loadLocalStoryProgress(storage, legacyKey), childIds);
  if (!storage || decision === 'keep') return decision;
  try {
    if (decision === 'move') {
      const raw = storage.getItem(legacyKey);
      const userKey = progressStorageKey(userId);
      if (raw && !storage.getItem(userKey)) storage.setItem(userKey, raw);
    }
    storage.removeItem(legacyKey);
  } catch {
    // 저장소 오류가 재생을 막아선 안 된다.
  }
  return decision;
}

/**
 * 홈·서재에 보여 줄 진행: 선택된 아이의 기록만. 내 아이 목록에 없는 아이의 기록이거나, 아이 구분이 없는 기록이거나,
 * 다른 아이의 기록이면 보이지 않는다.
 */
export function progressForSelectedChild(
  progress: LocalStoryProgress | null,
  childIds: readonly string[],
  selectedChildId: string | null | undefined,
): LocalStoryProgress | null {
  if (!progress || !progress.childId || !selectedChildId) return null;
  if (!childIds.includes(progress.childId)) return null;
  return progress.childId === selectedChildId ? progress : null;
}

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
