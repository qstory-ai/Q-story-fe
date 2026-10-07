/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ageYearsFromBirthYear, appEntryMetadata, deriveAppEntry, hrefWithFrom, utmFromHref } from './app-entry';
import { landingViewMetadata } from './landing-events';

const at = (path: string) => `https://app.qstory.kr${path}`;

test('첫 화면 주소로 들어온 경로를 나눈다', () => {
  assert.equal(deriveAppEntry(at('/')).entry, 'direct');
  assert.equal(deriveAppEntry(at('/join?code=ABCD12')).entry, 'class_link');
  assert.equal(deriveAppEntry(at('/?flow=sign-up&role=parent&code=ABCD12')).entry, 'class_link');
  assert.equal(deriveAppEntry(at('/org-invite/xyz')).entry, 'invite_link');
  assert.equal(deriveAppEntry(at('/tutor-invite/xyz')).entry, 'invite_link');
  assert.equal(deriveAppEntry(at('/reports/abc')).entry, 'report_link');
  assert.equal(deriveAppEntry(at('/tutorial')).entry, 'tutorial');
  // 알림에서 연 주소는 경로보다 출처가 먼저다.
  assert.equal(deriveAppEntry(at('/reports/abc?from=notification')).entry, 'notification');
});

test('app_entry 메타데이터는 쿼리 뺀 경로·반 코드 여부·utm을 싣는다', () => {
  assert.deepEqual(appEntryMetadata(at('/join?code=ABCD12&utm_source=kakao')), {
    entry: 'class_link',
    path: '/join',
    has_class_code: true,
    utm_source: 'kakao',
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
  });
  assert.deepEqual(utmFromHref(null), {});
});

test('만 나이는 올해 - 출생연도, 범위를 벗어나거나 없으면 보내지 않는다', () => {
  const now = new Date('2026-10-08T00:00:00Z');
  assert.equal(ageYearsFromBirthYear(2020, now), 6);
  assert.equal(ageYearsFromBirthYear(2026, now), 0);
  assert.equal(ageYearsFromBirthYear(null, now), null);
  assert.equal(ageYearsFromBirthYear(2030, now), null);
  assert.equal(ageYearsFromBirthYear(1990, now), null);
});

test('알림 링크에는 from=을 붙이고, 바깥 주소나 이미 있는 from은 그대로 둔다', () => {
  assert.equal(hrefWithFrom('/reports/abc', 'notification'), '/reports/abc?from=notification');
  assert.equal(hrefWithFrom('/reports/abc?x=1#top', 'notification'), '/reports/abc?x=1&from=notification#top');
  assert.equal(hrefWithFrom('/reports/abc?from=home_card', 'notification'), '/reports/abc?from=home_card');
  assert.equal(hrefWithFrom('https://example.com/a', 'notification'), 'https://example.com/a');
  assert.equal(hrefWithFrom('//example.com/a', 'notification'), '//example.com/a');
});

test('landing_view는 page·entry와 utm만 싣는다(서버 허용 키)', () => {
  assert.deepEqual(landingViewMetadata('landing', at('/?utm_source=insta&utm_campaign=beta')), {
    page: 'landing',
    entry: 'app',
    utm_source: 'insta',
    utm_medium: null,
    utm_campaign: 'beta',
    utm_content: null,
  });
  assert.deepEqual(landingViewMetadata('tutorial', null), { page: 'tutorial', entry: 'app' });
});
