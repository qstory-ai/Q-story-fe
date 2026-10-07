import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveVoiceResearchEnabled } from './voice-research-enabled';

const on = { enabled: true, explicit: true };

test('보호자가 명시적으로 동의했을 때만 켠다', () => {
  assert.equal(resolveVoiceResearchEnabled('PARENT', on), true);
});

test('보호자라도 동의 기록이 없거나(기본값) 철회했으면 끈다', () => {
  assert.equal(resolveVoiceResearchEnabled('PARENT', { enabled: true, explicit: false }), false);
  assert.equal(resolveVoiceResearchEnabled('PARENT', { enabled: false, explicit: true }), false);
  assert.equal(resolveVoiceResearchEnabled('PARENT', { enabled: false, explicit: false }), false);
});

test('조회 실패(null)나 아직 조회 전이면 끈다', () => {
  assert.equal(resolveVoiceResearchEnabled('PARENT', null), false);
});

test('보호자가 아닌 역할과 비로그인은 동의 값과 상관없이 끈다', () => {
  for (const role of ['TUTOR', 'ORGANIZATION_ADMIN', 'ADMIN', null, undefined]) {
    assert.equal(resolveVoiceResearchEnabled(role, on), false);
  }
});
