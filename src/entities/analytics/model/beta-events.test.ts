/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createBetaId,
  getCompletionSurveyUrl,
  trafficTypeForUrl,
  viewportClassForWidth,
} from './beta-events';
import { sanitizeQuestionText } from './question-text';

test('베타 식별자는 UUID 형태다', () => {
  assert.match(
    createBetaId(),
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
});

test('설문 링크는 사용자에게 내부 세션 코드를 노출하지 않는다', () => {
  const url = new URL(getCompletionSurveyUrl());
  assert.equal(url.search, '');
  assert.equal(
    url.origin + url.pathname,
    'https://docs.google.com/forms/d/e/1FAIpQLSeO0R44UwcGSc8EQKGLWAIA5OEvAUjOLjP_VRIY2kWUtBbCjQ/viewform',
  );
});

test('viewport classification keeps 430px and below in compact mobile', () => {
  assert.equal(viewportClassForWidth(360), 'mobile-compact');
  assert.equal(viewportClassForWidth(430), 'mobile-compact');
  assert.equal(viewportClassForWidth(431), 'mobile');
  assert.equal(viewportClassForWidth(900), 'tablet');
  assert.equal(viewportClassForWidth(1440), 'desktop');
  assert.equal(viewportClassForWidth(null), 'unknown');
});

test('운영·QA·로컬 트래픽을 URL 기준으로 분리한다', () => {
  assert.equal(trafficTypeForUrl('https://play.qstory.ai.kr'), 'beta');
  assert.equal(
    trafficTypeForUrl('https://play.qstory.ai.kr/?traffic_type=qa'),
    'qa',
  );
  assert.equal(
    trafficTypeForUrl('https://qstory-beta-player-demo.vercel.app'),
    'qa',
  );
  assert.equal(trafficTypeForUrl('http://localhost:8081'), 'dev');
  assert.equal(
    trafficTypeForUrl('https://play.qstory.ai.kr/?traffic_type=invalid'),
    'beta',
  );
});

test('question_result 이벤트의 질문 문장은 개인정보를 비식별화한다', () => {
  assert.equal(
    sanitizeQuestionText(
      '민지가 010-1234-5678로 연락해도 돼? test@example.com',
      '민지',
    ),
    '[이름]가 [연락처]로 연락해도 돼? [이메일]',
  );
});
