// @ts-nocheck -- Node 테스트 러너 타입을 의도적으로 Expo 번들에서 제외한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { canSubmitLaunchNotification, launchNotificationPhone } from './launch-notification-form';

const base = { parentName: '홍길동', phone: '', childGender: 'GIRL', childAge: '5세', discoverySource: '지인' };

test('decline needs no phone number', () => {
  assert.equal(canSubmitLaunchNotification(base, false), true);
});

test('wants-contact requires a phone number', () => {
  assert.equal(canSubmitLaunchNotification(base, true), false);
  assert.equal(canSubmitLaunchNotification({ ...base, phone: '  ' }, true), false);
  assert.equal(canSubmitLaunchNotification({ ...base, phone: '010-1234-5678' }, true), true);
});

test('other required fields are needed for both choices', () => {
  for (const wantsContact of [true, false]) {
    const filled = { ...base, phone: '010-1234-5678' };
    assert.equal(canSubmitLaunchNotification({ ...filled, parentName: ' ' }, wantsContact), false);
    assert.equal(canSubmitLaunchNotification({ ...filled, childGender: null }, wantsContact), false);
    assert.equal(canSubmitLaunchNotification({ ...filled, childAge: '' }, wantsContact), false);
    assert.equal(canSubmitLaunchNotification({ ...filled, discoverySource: '' }, wantsContact), false);
  }
});

test('phone is only sent when the guardian wants contact', () => {
  assert.equal(launchNotificationPhone(' 010-1 ', true), '010-1');
  assert.equal(launchNotificationPhone('010-1', false), undefined);
});
