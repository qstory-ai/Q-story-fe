// @ts-nocheck -- Node 테스트 러너 타입을 의도적으로 Expo 번들에서 제외한다.
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
