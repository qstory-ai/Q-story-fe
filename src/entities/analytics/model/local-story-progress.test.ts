// @ts-nocheck -- Node 테스트 어설션은 테스트 전용 전역 변수를 의도적으로 사용한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clearLocalStoryProgress,
  loadLocalStoryProgress,
  localStoryProgressStorageKey,
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
      inputMode: 'voice',
    }),
    {
      status: 'awaiting-question',
      sceneId: 'HG-F04',
      anchorId: 'HG-Q-A',
      questionRound: 1,
    },
  );
});

test('clearing progress prevents a resume prompt', () => {
  const storage = memoryStorage();
  storage.setItem(localStoryProgressStorageKey, '{"version":1}');
  clearLocalStoryProgress(storage);
  assert.equal(loadLocalStoryProgress(storage), null);
});
