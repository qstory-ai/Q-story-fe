import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseStudentNames } from './parse-student-names';

test('줄바꿈·쉼표·탭으로 나누고 공백과 빈 칸을 정리한다', () => {
  const { names, duplicates } = parseStudentNames(' 민서 \n\n지우, 하준\t서연 ,');
  assert.deepEqual(names, ['민서', '지우', '하준', '서연']);
  assert.deepEqual(duplicates, []);
});

test('같은 이름은 한 번만 남기고 나머지는 duplicates로 돌려준다', () => {
  const { names, duplicates } = parseStudentNames('민서\n민 서\nMINSEO\nminseo');
  assert.deepEqual(names, ['민서', 'MINSEO']);
  assert.deepEqual(duplicates, ['민 서', 'minseo']);
});

test('빈 입력은 빈 목록', () => {
  assert.deepEqual(parseStudentNames('  \n , '), { names: [], duplicates: [] });
});
