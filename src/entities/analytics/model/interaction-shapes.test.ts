// @ts-nocheck -- Node 테스트 러너 타입은 Expo 번들에서 의도적으로 제외한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  HesitationDetector,
  ScrollDepthTracker,
  normalizeScreenPath,
  normalizedPoint,
  scrollDepthOf,
  splitByBudget,
  targetLabelFrom,
  targetRoleFrom,
} from './interaction-shapes';

test('screen path drops query/hash and replaces ids with :id', () => {
  assert.equal(normalizeScreenPath('/'), '/');
  assert.equal(normalizeScreenPath(''), '/');
  assert.equal(normalizeScreenPath('/stories/hansel-gretel/play?childId=abc#x'), '/stories/hansel-gretel/play');
  assert.equal(normalizeScreenPath('/reports/3fa2c1d4-1234-4abc-8def-0123456789ab'), '/reports/:id');
  assert.equal(normalizeScreenPath('/org-invite/Ab3dE_fG-hIjK1mNoP'), '/org-invite/:id');
  assert.equal(normalizeScreenPath('/tutor/lessons/123456/'), '/tutor/lessons/:id');
  assert.equal(normalizeScreenPath('/onboarding/parent'), '/onboarding/parent');
});

test('target label prefers aria-label, then visible text, trimmed to 80 chars', () => {
  assert.equal(targetLabelFrom({ tag: 'div', role: 'button', ariaLabel: '  이야기 시작하기 ', text: '시작' }), '이야기 시작하기');
  assert.equal(targetLabelFrom({ tag: 'div', role: 'button', text: '  다시\n  읽기 ' }), '다시 읽기');
  assert.equal(targetLabelFrom({ tag: 'a', text: '가'.repeat(120) }).length, 80);
  assert.equal(targetLabelFrom({ tag: 'div', text: '   ' }), null);
});

test('text entry fields never expose what was typed', () => {
  assert.equal(targetLabelFrom({ tag: 'input', text: '우리 아이 이름', placeholder: '아이 이름' }), '아이 이름');
  assert.equal(targetLabelFrom({ tag: 'TEXTAREA', text: '비밀' }), null);
  assert.equal(targetLabelFrom({ tag: 'input', ariaLabel: '아이 이름 (선택)', text: '철수' }), '아이 이름 (선택)');
});

test('target role is the role attribute, or the tag name', () => {
  assert.equal(targetRoleFrom({ tag: 'DIV', role: 'button' }), 'button');
  assert.equal(targetRoleFrom({ tag: 'INPUT', role: null }), 'input');
});

test('points are normalized to 0..1 and scroll depth ignores boxes that cannot scroll vertically', () => {
  assert.equal(normalizedPoint(195, 390), 0.5);
  assert.equal(normalizedPoint(500, 390), 1);
  assert.equal(normalizedPoint(10, 0), null);
  assert.equal(scrollDepthOf(0, 800, 800), null);
  assert.equal(scrollDepthOf(400, 800, 1600), 0.75);
});

test('hesitation is reported only after 5s without activity, with what was tapped before', () => {
  const detector = new HesitationDetector(0);
  assert.equal(detector.activity(1_000, '이야기 시작하기'), null);
  assert.equal(detector.activity(5_999), null, 'a 4.999s pause is not hesitation');
  assert.deepEqual(detector.activity(12_000, '다음'), { durationMs: 6_001, lastTarget: '이야기 시작하기' });
  assert.deepEqual(detector.end(20_000), { durationMs: 8_000, lastTarget: '다음' });
  detector.reset(30_000);
  assert.equal(detector.activity(31_000), null, 'reset (new screen / visible again) does not count hidden time');
});

test('scroll depth is emitted when it grows, at most every 3s, and the rest on leave', () => {
  const tracker = new ScrollDepthTracker();
  assert.equal(tracker.observe(0.3, 0), 0.3);
  assert.equal(tracker.observe(0.5, 1_000), null, 'throttled');
  assert.equal(tracker.observe(0.4, 3_500), 0.5, 'keeps the max');
  assert.equal(tracker.observe(0.9, 5_000), null, 'throttled again');
  assert.equal(tracker.takePending(5_500), 0.9, 'leaving sends what was held back');
  assert.equal(tracker.takePending(6_000), null);
  assert.equal(tracker.observe(0.9, 10_000), null, 'unchanged depth is not sent again');
});

test('splitByBudget keeps groups under the byte and item limits and drops oversized items', () => {
  const items = Array.from({ length: 10 }, (_, index) => ({ index, text: '가'.repeat(100) }));
  const groups = splitByBudget(items, 700, 50);
  assert.ok(groups.length > 1);
  assert.deepEqual(groups.flat().map((item) => item.index), items.map((item) => item.index));
  for (const group of groups) assert.ok(Buffer.byteLength(JSON.stringify(group)) <= 702);
  assert.deepEqual(splitByBudget(items, 100_000, 4).map((group) => group.length), [4, 4, 2]);
  assert.deepEqual(splitByBudget([{ text: 'x'.repeat(1_000) }, { ok: 1 }], 200, 10), [[{ ok: 1 }]]);
});
