// @ts-nocheck -- Node 테스트 러너 타입은 Expo 번들에서 의도적으로 제외한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { idleStatusFor, idleSubtitleFor, readingContextFor } from './reading-context';

test('반 수업 > 선생님 세션·계정 > 가정 순으로 읽는 자리를 정한다', () => {
  assert.equal(readingContextFor({ lessonId: 'l1', tutorStudentId: 's1', role: 'TUTOR' }), 'CLASS');
  assert.equal(readingContextFor({ tutorStudentId: 's1', role: 'TUTOR' }), 'TEACHER');
  assert.equal(readingContextFor({ role: 'TUTOR' }), 'TEACHER');
  assert.equal(readingContextFor({ role: 'DIRECTOR' }), 'TEACHER');
  assert.equal(readingContextFor({ role: 'PARENT' }), 'HOME');
  assert.equal(readingContextFor({}), 'HOME');
});

test('가정이 아니면 "부모님" 문구를 쓰지 않는다', () => {
  for (const context of ['TEACHER', 'CLASS']) {
    assert.ok(!idleSubtitleFor(context).includes('부모님'));
    assert.ok(!idleStatusFor(context).includes('부모님'));
  }
  assert.ok(idleSubtitleFor('TEACHER').startsWith('선생님과 아이가'));
  assert.ok(idleSubtitleFor('HOME').startsWith('부모님과 아이가'));
});
