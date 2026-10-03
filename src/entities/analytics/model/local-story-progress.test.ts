// @ts-nocheck -- Node 테스트 어설션은 테스트 전용 전역 변수를 의도적으로 사용한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clearLocalStoryProgress,
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
