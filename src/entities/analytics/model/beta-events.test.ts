/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  betaErrorCode,
  betaEventHeaders,
  betaEventSource,
  createBetaId,
  shapeBetaMetadata,
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

test('이벤트 source - 앱 화면은 app, 소개 화면은 landing, 나머지는 player', () => {
  assert.equal(betaEventSource('app_entry'), 'app');
  assert.equal(betaEventSource('signup_completed'), 'app');
  assert.equal(betaEventSource('class_join'), 'app');
  assert.equal(betaEventSource('report_action'), 'app');
  assert.equal(betaEventSource('landing_view'), 'landing');
  assert.equal(betaEventSource('landing_cta_click'), 'landing');
  assert.equal(betaEventSource('playback_control'), 'player');
  assert.equal(betaEventSource('story_started'), 'player');
});

test('메타데이터는 빈 값을 빼고 짧은 값은 80자로 자른다(질문 원문 키 제외)', () => {
  const long = 'ㄱ'.repeat(120);
  assert.deepEqual(
    shapeBetaMetadata({
      entry: 'direct',
      empty: '',
      blank: '   ',
      missing: null,
      notSet: undefined,
      nan: Number.NaN,
      latency_ms: 1200,
      has_class_code: false,
      path: long,
      question_text: long,
    }),
    { entry: 'direct', latency_ms: 1200, has_class_code: false, path: 'ㄱ'.repeat(80), question_text: long },
  );
});

test('로그인 상태면 통계 요청에 토큰을 싣는다', () => {
  assert.deepEqual(betaEventHeaders(null), { 'Content-Type': 'application/json' });
  assert.deepEqual(betaEventHeaders('tok'), { 'Content-Type': 'application/json', Authorization: 'Bearer tok' });
});

test('실패는 서버 코드 → HTTP 상태 → UNKNOWN 순으로 오류 코드가 된다', () => {
  assert.equal(betaErrorCode({ code: 'CLASS_NOT_FOUND', status: 404 }), 'CLASS_NOT_FOUND');
  assert.equal(betaErrorCode({ code: '', status: 503 }), 'HTTP_503');
  assert.equal(betaErrorCode(new Error('boom')), 'UNKNOWN');
  assert.equal(betaErrorCode(null), 'UNKNOWN');
});
