// @ts-nocheck -- Node 테스트 러너 타입은 Expo 번들에서 의도적으로 제외한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { looksLikeKoreanQuestion, punctuateChildQuestion } from './question-punctuation';

test('의문사와 반말 끝말이 함께 있으면 물음표를 붙인다(받아 적은 마침표는 걷는다)', () => {
  assert.equal(punctuateChildQuestion('새를 좀 어떻게 살펴보면 좋을 거 같애.'), '새를 좀 어떻게 살펴보면 좋을 거 같애?');
  assert.equal(punctuateChildQuestion('왜 헨젤은 돌을 주워'), '왜 헨젤은 돌을 주워?');
  assert.equal(punctuateChildQuestion('마녀는 어디에 살아요'), '마녀는 어디에 살아요?');
  assert.equal(punctuateChildQuestion('누가 문을 잠갔지'), '누가 문을 잠갔지?');
  assert.equal(punctuateChildQuestion('그 새는 뭐야'), '그 새는 뭐야?');
});

test('…까 · …니 · …냐 · …나요는 의문사 없이도 질문이다', () => {
  assert.equal(punctuateChildQuestion('반짝이는 돌을 따라가면 집에 갈 수 있을까'), '반짝이는 돌을 따라가면 집에 갈 수 있을까?');
  assert.equal(punctuateChildQuestion('같이 가 볼까요.'), '같이 가 볼까요?');
  assert.equal(punctuateChildQuestion('배고프지 않니'), '배고프지 않니?');
  assert.equal(punctuateChildQuestion('진짜 마녀냐'), '진짜 마녀냐?');
  assert.equal(punctuateChildQuestion('새가 길을 알려 주나요'), '새가 길을 알려 주나요?');
});

test('평서문·이어 말하는 끝말·의문사 아닌 낱말은 그대로 둔다', () => {
  assert.equal(punctuateChildQuestion('반짝이는 하얀 돌이 무슨 의미가 있는 건데.'), '반짝이는 하얀 돌이 무슨 의미가 있는 건데.');
  assert.equal(punctuateChildQuestion('새가 자꾸 돌아보니까'), '새가 자꾸 돌아보니까');
  assert.equal(punctuateChildQuestion('숲에 갔더니'), '숲에 갔더니');
  assert.equal(punctuateChildQuestion('나는 과자집이 좋아'), '나는 과자집이 좋아');
  assert.equal(punctuateChildQuestion('뭐든지 좋아'), '뭐든지 좋아');
  assert.equal(punctuateChildQuestion('언제나 같이 있어'), '언제나 같이 있어');
  assert.equal(punctuateChildQuestion('아까'), '아까');
  assert.equal(punctuateChildQuestion('우리 언니'), '우리 언니');
  assert.equal(punctuateChildQuestion('도와줘'), '도와줘');
  assert.equal(punctuateChildQuestion('새가 어디로 날아갔다'), '새가 어디로 날아갔다');
  assert.equal(punctuateChildQuestion('왜냐하면 무서우니까'), '왜냐하면 무서우니까');
});

test('이미 물음표·느낌표가 있거나 빈 글이면 건드리지 않는다', () => {
  assert.equal(punctuateChildQuestion('왜 그랬어?'), '왜 그랬어?');
  assert.equal(punctuateChildQuestion('어떻게 해!'), '어떻게 해!');
  assert.equal(punctuateChildQuestion('  '), '');
  assert.equal(looksLikeKoreanQuestion('hello why'), false);
});
