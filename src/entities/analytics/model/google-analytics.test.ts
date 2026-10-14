/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { LEGACY_REDIRECTS } from '../../../app/legacy-redirects';

import {
  gaEventForBetaEvent,
  gaPagePath,
  gaReferrer,
  gaUtmQuery,
  isGaHitUrl,
  scrubGaHit,
  shapeGaParams,
} from './google-analytics';

const appPath = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..', 'app', 'App.tsx');

test('식별자가 들어가는 경로는 경로 틀로 바꾼다', () => {
  assert.equal(gaPagePath('/org-invite/0a1b2c3d-1111-4222-8333-444455556666'), '/org-invite/:token');
  assert.equal(gaPagePath('/org-invite/code/ABCD1234'), '/org-invite/code/:code');
  assert.equal(gaPagePath('/reports/0a1b2c3d-1111-4222-8333-444455556666'), '/reports/:completionId');
  assert.equal(gaPagePath('/organization/classes/12/students/34'), '/organization/classes/:classId/students/:studentId');
  assert.equal(gaPagePath('/tutor/classes/new'), '/tutor/classes/new');
  assert.equal(gaPagePath('/tutor/lessons/abc'), '/tutor/lessons/:lessonId');
});

test('이야기·장면 id(콘텐츠 이름)는 남기고, UUID·긴 숫자는 지운다', () => {
  assert.equal(gaPagePath('/stories/HG/play'), '/stories/HG/play');
  assert.equal(gaPagePath('/staff/HG/scenes/scene-03'), '/staff/HG/scenes/scene-03');
  assert.equal(gaPagePath('/stories/a1b2c3d4-1111-4222-8333-444455556666'), '/stories/:storyId');
  assert.equal(gaPagePath('/stories/kid1234567'), '/stories/:storyId');
});

test('모르는 경로는 /(other)', () => {
  assert.equal(gaPagePath('/somewhere/secret-token'), '/(other)');
});

test('App.tsx의 모든 경로가 GA 경로 목록에 있다', () => {
  const source = readFileSync(appPath, 'utf8');
  const paths = [...source.matchAll(/<Route\s+path="([^"]+)"/g)].map((match) => match[1]).filter((path) => path !== '*');
  paths.push(...LEGACY_REDIRECTS.map(([from]) => from));
  assert.ok(paths.length > 30);
  const missing = paths.filter((path) => gaPagePath(path.replace(/:[A-Za-z]+/g, 'x1')) === '/(other)');
  assert.deepEqual(missing, []);
});

test('쿼리는 utm만 남긴다', () => {
  assert.equal(
    gaUtmQuery('https://demo.qstory.ai.kr/join?code=SECRET&utm_source=qr&utm_medium=offline&session_id=x'),
    '?utm_source=qr&utm_medium=offline',
  );
  assert.equal(gaUtmQuery('https://demo.qstory.ai.kr/?code=SECRET'), '');
});

test('page_referrer는 다른 사이트면 출처만, 같은 사이트면 경로 틀', () => {
  assert.equal(gaReferrer('https://mail.example/inbox/123?x=1', 'https://demo.qstory.ai.kr'), 'https://mail.example/');
  assert.equal(
    gaReferrer('https://demo.qstory.ai.kr/org-invite/tok', 'https://demo.qstory.ai.kr'),
    'https://demo.qstory.ai.kr/org-invite/:token',
  );
  assert.equal(gaReferrer('', 'https://demo.qstory.ai.kr'), undefined);
});

test('이벤트 값은 허용 키의 분류값·숫자만 - id·문장·이름은 버린다', () => {
  assert.deepEqual(
    shapeGaParams('report_open', { kind: 'HOME', source: 'list', completion_id: 'abc', viewer_role: 'PARENT' }),
    { kind: 'home', source: 'list', viewer_role: 'parent' },
  );
  assert.deepEqual(shapeGaParams('story_start', { resume: false, play_session_id: 'x', entry_source: '홍길동' }), {
    resume: 'false',
  });
  assert.deepEqual(shapeGaParams('story_complete', { duration_seconds: 300, question_count: 3, changed_scene_count: Number.NaN }), {
    duration_seconds: 300,
    question_count: 3,
  });
});

test('GA로 보내는 자체 통계 이벤트', () => {
  assert.equal(gaEventForBetaEvent('landing_cta_click', {}), 'cta_click');
  assert.equal(gaEventForBetaEvent('signup_completed', {}), 'sign_up');
  assert.equal(gaEventForBetaEvent('story_started', {}), 'story_start');
  assert.equal(gaEventForBetaEvent('story_completed', {}), 'story_complete');
  assert.equal(gaEventForBetaEvent('dialogue_step', { turn_kind: 'OPEN' }), 'gretel_open');
  assert.equal(gaEventForBetaEvent('dialogue_step', { turn_kind: 'HELP' }), 'help_request');
  assert.equal(gaEventForBetaEvent('dialogue_step', { turn_kind: 'CHILD_TURN' }), null);
  assert.equal(gaEventForBetaEvent('report_viewed', {}), 'report_open');
  assert.equal(gaEventForBetaEvent('question_result', {}), null);
});

const SITE = { siteOrigin: 'https://demo.qstory.ai.kr' };
const COLLECT = 'https://region1.google-analytics.com/g/collect?v=2&tid=G-X';

function hit(params: Record<string, string>) {
  return `${COLLECT}&${new URLSearchParams(params).toString()}`;
}

test('GA 요청만 고친다', () => {
  assert.equal(isGaHitUrl(COLLECT), true);
  assert.equal(isGaHitUrl('https://www.google-analytics.com/g/collect?v=2'), true);
  assert.equal(isGaHitUrl('https://demo.qstory.ai.kr/api/qstory/v1/beta-events'), false);
  assert.equal(isGaHitUrl('https://www.googletagmanager.com/gtag/js?id=G-X'), false);
});

test('기록 변경으로 gtag가 따로 보낸 page_view(실제 주소)는 보내지 않는다', () => {
  const url = hit({ en: 'page_view', dl: 'https://demo.qstory.ai.kr/org-invite/SECRET?x=1', dt: '헨젤과 그레텔' });
  assert.equal(scrubGaHit(url, null, SITE), null);
});

test('우리 page_view도 dl·dr·dt를 한 번 더 경로 틀로 고친다', () => {
  const url = hit({
    en: 'page_view',
    'ep.qs_surface': 'app',
    dl: 'https://demo.qstory.ai.kr/stories/HG?utm_source=qr',
    dr: 'https://demo.qstory.ai.kr/join?code=SECRET',
    dt: 'x',
  });
  const scrubbed = scrubGaHit(url, null, SITE);
  assert.ok(scrubbed);
  const params = new URL(scrubbed.url).searchParams;
  assert.equal(params.get('dl'), 'https://demo.qstory.ai.kr/stories/HG?utm_source=qr');
  assert.equal(params.get('dr'), 'https://demo.qstory.ai.kr/join');
  assert.equal(params.get('dt'), '/stories/HG');
  assert.doesNotMatch(scrubbed.url, /SECRET/);
});

test('자동 이벤트는 스크롤·머문 시간만 남기고 주소를 고친다, 클릭·폼은 뺀다', () => {
  const scroll = scrubGaHit(hit({ en: 'scroll', dl: 'https://demo.qstory.ai.kr/org-invite/SECRET' }), null, SITE);
  assert.equal(new URL(scroll?.url ?? COLLECT).searchParams.get('dl'), 'https://demo.qstory.ai.kr/org-invite/:token');
  assert.equal(scrubGaHit(hit({ en: 'click', 'ep.link_url': 'https://x.example/?t=1' }), null, SITE), null);
  assert.equal(scrubGaHit(hit({ en: 'form_start' }), null, SITE), null);
});

test('여러 이벤트를 묶은 본문은 줄마다 거르고 고친다 - 남는 것이 없으면 보내지 않는다', () => {
  const url = `${COLLECT}&dl=${encodeURIComponent('https://demo.qstory.ai.kr/reports/abc-123')}`;
  const body = ['en=page_view&dl=https%3A%2F%2Fdemo.qstory.ai.kr%2Freports%2Fabc', 'en=story_start&ep.qs_surface=app', 'en=click'].join('\n');
  const scrubbed = scrubGaHit(url, body, SITE);
  assert.ok(scrubbed);
  assert.equal(new URL(scrubbed.url).searchParams.get('dl'), 'https://demo.qstory.ai.kr/reports/:completionId');
  assert.deepEqual(scrubbed.body?.split('\n').map((line) => new URLSearchParams(line).get('en')), ['story_start']);
  assert.equal(scrubGaHit(COLLECT, 'en=click\nen=form_submit', SITE), null);
});

test('네이티브 앱은 보고서 주소의 출처를 app.qstory.ai.kr로 바꾼다', () => {
  const scrubbed = scrubGaHit(hit({ en: 'scroll', dl: 'capacitor://app.qstory.ai.kr/library' }), null, {
    siteOrigin: 'capacitor://app.qstory.ai.kr',
    originOverride: 'https://app.qstory.ai.kr',
  });
  assert.equal(new URL(scrubbed?.url ?? COLLECT).searchParams.get('dl'), 'https://app.qstory.ai.kr/library');
});
