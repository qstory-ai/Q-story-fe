/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { billingGuidance, formatWon, paymentStatusLabel, receiptLink } from './billing-text';

test('결제 안내는 자동 결제가 없다고 말하고 기간을 알면 일수를 넣는다', () => {
  const withDays = billingGuidance(30).join(' ');
  assert.match(withDays, /30일 동안/);
  assert.match(withDays, /자동으로 다시 결제되지 않아/);
  assert.match(billingGuidance().join(' '), /결제한 기간 동안/);
  assert.match(billingGuidance(0).join(' '), /결제한 기간 동안/);
});

test('결제 상태 라벨', () => {
  assert.equal(paymentStatusLabel('PAID'), '결제 완료');
});

test('금액은 원 단위로 쉼표를 넣는다', () => {
  assert.equal(formatWon(9900), '9,900원');
  assert.equal(formatWon(120000), '120,000원');
});

test('영수증 링크는 https일 때만 쓴다', () => {
  assert.equal(receiptLink({ receiptUrl: 'https://dashboard.tosspayments.com/receipt/a' }), 'https://dashboard.tosspayments.com/receipt/a');
  assert.equal(receiptLink({ receiptUrl: null }), null);
  assert.equal(receiptLink({ receiptUrl: '' }), null);
  assert.equal(receiptLink({ receiptUrl: 'javascript:alert(1)' }), null);
});
