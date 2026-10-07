import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CONSENT_VERSION, toConsentPayload } from './consent';

test('동의 버전 상수는 API 계약과 같다', () => {
  assert.equal(CONSENT_VERSION, '2026-10-v1');
});

test('toConsentPayload는 화면 상태를 API 필드로 옮긴다', () => {
  assert.deepEqual(toConsentPayload({ service: true, privacy: true, marketing: false }), {
    version: '2026-10-v1',
    terms: true,
    privacy: true,
    marketing: false,
  });
  assert.deepEqual(toConsentPayload({ service: true, privacy: false, marketing: true }), {
    version: '2026-10-v1',
    terms: true,
    privacy: false,
    marketing: true,
  });
});
