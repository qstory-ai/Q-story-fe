// @ts-nocheck -- Node test runner types are intentionally kept out of the Expo bundle.
import assert from 'node:assert/strict';
import test from 'node:test';

import { childCall, personalizeStoryText } from './child-address';

test('Korean child call uses the correct vocative particle', () => {
  assert.equal(childCall('민준'), '민준아');
  assert.equal(childCall('지우'), '지우야');
  assert.equal(childCall(''), '친구야');
  assert.equal(
    personalizeStoryText('{child_call}, 너는 뭐가 궁금해?', '하윤'),
    '하윤아, 너는 뭐가 궁금해?',
  );
});
