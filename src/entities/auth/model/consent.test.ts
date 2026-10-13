import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CONSENT_VERSION, pendingConsentsOf, toConsentPayload } from './consent';

test('동의 버전 상수는 API 계약과 같다', () => {
  assert.equal(CONSENT_VERSION, '2026-10-v2');
});

test('toConsentPayload는 화면 상태를 API 필드로 옮긴다', () => {
  assert.deepEqual(
    toConsentPayload({ service: true, privacy: true, marketing: false, guardian: true, overseas: true }),
    {
      version: '2026-10-v2',
      terms: true,
      privacy: true,
      marketing: false,
      guardian: true,
      overseasTransfer: true,
    },
  );
  assert.deepEqual(
    toConsentPayload({ service: true, privacy: false, marketing: true, guardian: false, overseas: false }),
    {
      version: '2026-10-v2',
      terms: true,
      privacy: false,
      marketing: true,
      guardian: false,
      overseasTransfer: false,
    },
  );
});

test('pendingConsentsOf는 STAFF와 예전 서버 응답(값 없음)에서 비어 있다', () => {
  assert.deepEqual(pendingConsentsOf({ role: 'PARENT', pendingConsents: ['GUARDIAN', 'OVERSEAS_TRANSFER'] }), [
    'GUARDIAN',
    'OVERSEAS_TRANSFER',
  ]);
  assert.deepEqual(pendingConsentsOf({ role: 'STAFF', pendingConsents: ['OVERSEAS_TRANSFER'] }), []);
  assert.deepEqual(pendingConsentsOf({ role: 'TUTOR' }), []);
  assert.deepEqual(pendingConsentsOf({ role: 'DIRECTOR', pendingConsents: ['ORG_GUARDIAN_ACK', 'UNKNOWN'] }), [
    'ORG_GUARDIAN_ACK',
  ]);
});
