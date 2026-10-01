/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { teacherTitle, withParticle } from './korean-particle';

test('withParticle picks the particle by final consonant', () => {
  assert.equal(withParticle('헨젤과 그레텔', '을/를'), '헨젤과 그레텔을');
  assert.equal(withParticle('하윤', '이/가'), '하윤이');
  assert.equal(withParticle('민서', '이/가'), '민서가');
  assert.equal(withParticle('햇님반', '과/와'), '햇님반과');
  assert.equal(withParticle('나무', '과/와'), '나무와');
});

test('withParticle keeps both forms when the word does not end in Hangul', () => {
  assert.equal(withParticle('Class A', '을/를'), 'Class A을(를)');
  assert.equal(withParticle('3반2', '이/가'), '3반2이(가)');
});

test('teacherTitle does not repeat 선생님', () => {
  assert.equal(teacherTitle('김하늘'), '김하늘 선생님');
  assert.equal(teacherTitle('QA선생님'), 'QA선생님');
  assert.equal(teacherTitle('하늘 선생님 '), '하늘 선생님');
});
