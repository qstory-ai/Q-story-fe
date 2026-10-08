// @ts-nocheck -- Node 테스트 어설션은 테스트 전용 전역 변수를 의도적으로 사용한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clearLocalStoryProgress,
  decideLegacyProgressMigration,
  migrateLegacyProgress,
  progressForSelectedChild,
  progressStorageKey,
  setLocalProgressOwner,
  loadLocalStoryProgress,
  localStoryProgressStorageKey,
  resumableProgressFor,
  resumableRuntimeState,
  saveLocalStoryProgress,
} from './local-story-progress';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

test('local resume saves progress without recordings or transcripts', () => {
  const storage = memoryStorage();
  const saved = saveLocalStoryProgress(
    {
      state: {
        status: 'playing-fixed',
        sceneId: 'HG-F04',
        audioGroupId: 'HG-F04-AG01',
        clipIndex: 1,
      },
      storyId: 'hansel-gretel',
      childName: '하윤',
      elapsedSeconds: 72,
      questionOutcomes: [],
    },
    storage,
  );

  assert.equal(saved, true);
  const raw = storage.getItem(localStoryProgressStorageKey) ?? '';
  assert.equal(raw.includes('recording'), false);
  assert.equal(raw.includes('transcript'), false);
  assert.equal(loadLocalStoryProgress(storage)?.state.status, 'playing-fixed');
});

test('an interrupted question resumes from its invitation', () => {
  assert.deepEqual(
    resumableRuntimeState({
      status: 'processing-question',
      sceneId: 'HG-F04',
      anchorId: 'HG-Q-A',
      questionRound: 1,
      consecutiveSafetyFailures: 2,
      inputMode: 'voice',
    }),
    {
      status: 'awaiting-question',
      sceneId: 'HG-F04',
      anchorId: 'HG-Q-A',
      questionRound: 1,
      // 재개는 항상 새 질문 시도로 취급되어 안전게이트 카운터가 리셋된다.
      consecutiveSafetyFailures: 0,
    },
  );
});

test('clearing progress prevents a resume prompt', () => {
  const storage = memoryStorage();
  storage.setItem(localStoryProgressStorageKey, '{"version":1}');
  clearLocalStoryProgress(storage);
  assert.equal(loadLocalStoryProgress(storage), null);
});

test('다른 이야기의 진행 기록은 이어듣기 후보가 아니다', () => {
  const progress = { storyId: 'HG' };
  assert.equal(resumableProgressFor(progress, 'HG'), progress);
  assert.equal(resumableProgressFor(progress, 'OTHER'), null);
  assert.equal(resumableProgressFor(null, 'HG'), null);
});

test('보호자 세션 진행에는 아이 id가 함께 저장된다', () => {
  const storage = memoryStorage();
  saveLocalStoryProgress(
    {
      state: { status: 'playing-fixed', sceneId: 'HG-F04', audioGroupId: 'HG-F04-AG01', clipIndex: 1 },
      storyId: 'hansel-gretel',
      childName: '하윤',
      childId: 'child-b',
      elapsedSeconds: 10,
      questionOutcomes: [],
    },
    storage,
  );
  assert.equal(loadLocalStoryProgress(storage)?.childId, 'child-b');
});

test('다른 아이가 남긴 진행은 이어듣기 후보가 아니다', () => {
  const progress = {
    version: 1,
    savedAt: '2026-10-01T00:00:00.000Z',
    state: { status: 'playing-fixed', sceneId: 'HG-F04', audioGroupId: 'HG-F04-AG01', clipIndex: 1 },
    storyId: 'hansel-gretel',
    childName: '하윤',
    childId: 'child-b',
    elapsedSeconds: 10,
    questionOutcomes: [],
  };
  assert.equal(resumableProgressFor(progress, 'hansel-gretel', 'child-a'), null);
  assert.equal(resumableProgressFor(progress, 'hansel-gretel', 'child-b'), progress);
  // 아이 id가 없는 이전 기록과 아이를 모르는 호출(데모)은 지금처럼 이야기만 맞으면 후보다.
  assert.equal(resumableProgressFor({ ...progress, childId: undefined }, 'hansel-gretel', 'child-a')?.storyId, 'hansel-gretel');
  assert.equal(resumableProgressFor(progress, 'hansel-gretel'), progress);
});

test('이어서 읽기는 같은 회차 id와 다음 대화 줄 번호, 읽은 범위를 이어 받는다(Q-39)', () => {
  const storage = memoryStorage();
  saveLocalStoryProgress(
    {
      state: { status: 'playing-fixed', sceneId: 'HG-F06', audioGroupId: 'HG-F06-AG01', clipIndex: 0 },
      storyId: 'HG',
      childName: '서아',
      elapsedSeconds: 300,
      questionOutcomes: [],
      sessionId: '6f1c3c1e-1b1a-4b7e-9a51-2a8f5f2e4c10',
      nextTurnSeq: 14,
      readFromSceneId: 'HG-F01',
      readThroughSceneId: 'HG-F06',
    },
    storage,
  );
  const loaded = loadLocalStoryProgress(storage);
  assert.equal(loaded.sessionId, '6f1c3c1e-1b1a-4b7e-9a51-2a8f5f2e4c10');
  assert.equal(loaded.nextTurnSeq, 14);
  assert.equal(loaded.readFromSceneId, 'HG-F01');
  assert.equal(loaded.readThroughSceneId, 'HG-F06');
});

test('회차 id가 없는 옛 진행 기록도 그대로 이어 읽을 수 있다', () => {
  const storage = memoryStorage();
  saveLocalStoryProgress(
    {
      state: { status: 'playing-fixed', sceneId: 'HG-F02', audioGroupId: 'HG-F02-AG01', clipIndex: 0 },
      storyId: 'HG',
      childName: '',
      elapsedSeconds: 10,
      questionOutcomes: [],
    },
    storage,
  );
  const loaded = loadLocalStoryProgress(storage);
  assert.ok(loaded);
  assert.equal(loaded.sessionId, undefined);
});

const base = (over = {}) => ({
  version: 1,
  savedAt: new Date().toISOString(),
  state: { status: 'playing-fixed', sceneId: 'S1', audioGroupId: 'A', clipIndex: 0 },
  storyId: 'HG',
  childName: '민준',
  elapsedSeconds: 10,
  questionOutcomes: [],
  ...over,
});
const save = (storage, over = {}) =>
  saveLocalStoryProgress({ ...base(over), state: base(over).state }, storage);

test('storage key is per user, anonymous keeps the old key', () => {
  assert.equal(progressStorageKey(null), localStoryProgressStorageKey);
  assert.equal(progressStorageKey(undefined), localStoryProgressStorageKey);
  assert.equal(progressStorageKey('u1'), `${localStoryProgressStorageKey}.u1`);
});

test('switching accounts never exposes the previous account progress', () => {
  const storage = memoryStorage();
  setLocalProgressOwner('u1');
  save(storage, { childId: 'c1' });
  assert.equal(loadLocalStoryProgress(storage)?.childId, 'c1');
  setLocalProgressOwner(null);
  assert.equal(loadLocalStoryProgress(storage), null);
  setLocalProgressOwner('u2');
  assert.equal(loadLocalStoryProgress(storage), null);
  clearLocalStoryProgress(storage);
  setLocalProgressOwner('u1');
  assert.equal(loadLocalStoryProgress(storage)?.childId, 'c1');
  clearLocalStoryProgress(storage);
  assert.equal(loadLocalStoryProgress(storage), null);
  setLocalProgressOwner(null);
});

test('progressForSelectedChild shows only the selected child own record', () => {
  const p = base({ childId: 'c1' });
  assert.equal(progressForSelectedChild(p, ['c1', 'c2'], 'c1'), p);
  assert.equal(progressForSelectedChild(p, ['c1', 'c2'], 'c2'), null);
  assert.equal(progressForSelectedChild(p, ['c2'], 'c2'), null);
  assert.equal(progressForSelectedChild(base(), ['c1'], 'c1'), null);
  assert.equal(progressForSelectedChild(p, ['c1'], null), null);
  assert.equal(progressForSelectedChild(null, ['c1'], 'c1'), null);
});

test('legacy migration decision', () => {
  assert.equal(decideLegacyProgressMigration(null, ['c1']), 'keep');
  assert.equal(decideLegacyProgressMigration(base({ childId: 'c1' }), ['c1']), 'move');
  assert.equal(decideLegacyProgressMigration(base({ childId: 'x' }), ['c1']), 'discard');
  assert.equal(decideLegacyProgressMigration(base(), ['c1']), 'discard');
  assert.equal(decideLegacyProgressMigration(base({ state: { status: 'complete' } }), ['c1']), 'keep');
});

test('migrateLegacyProgress moves, discards, and does not overwrite', () => {
  const storage = memoryStorage();
  save(storage, { childId: 'c1' }); // owner null => legacy key
  assert.equal(migrateLegacyProgress('u1', ['c1'], storage), 'move');
  assert.equal(loadLocalStoryProgress(storage, progressStorageKey(null)), null);
  assert.equal(loadLocalStoryProgress(storage, progressStorageKey('u1'))?.childId, 'c1');
  save(storage, { childId: 'c1', storyId: 'NEW' });
  migrateLegacyProgress('u1', ['c1'], storage);
  assert.equal(loadLocalStoryProgress(storage, progressStorageKey('u1'))?.storyId, 'HG');
  save(storage, { childId: 'other' });
  assert.equal(migrateLegacyProgress('u2', ['c9'], storage), 'discard');
  assert.equal(loadLocalStoryProgress(storage, progressStorageKey(null)), null);
  assert.equal(loadLocalStoryProgress(storage, progressStorageKey('u2')), null);
});
