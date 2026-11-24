// @ts-nocheck -- Node 테스트 러너 타입은 Expo 번들에서 의도적으로 제외한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { INSTALL_DISMISS_COOLDOWN_MS, installPromptKind, isIosSafari, isQuietPath } from './install-prompt-logic';

const IPAD_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0 Mobile/15E148 Safari/604.1';
const GALAXY_TAB_CHROME =
  'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const base = {
  pathname: '/parent',
  isNativePlatform: false,
  isStandalone: false,
  hasDeferredPrompt: false,
  userAgent: GALAXY_TAB_CHROME,
  maxTouchPoints: 5,
  dismissedAt: null,
  now: 1_000_000_000_000,
};

test('크롬이 설치 이벤트를 주면 설치 버튼을 띄운다', () => {
  assert.equal(installPromptKind({ ...base, hasDeferredPrompt: true }), 'native-prompt');
  assert.equal(installPromptKind(base), null);
});

test('아이패드 사파리에서는 추가 방법을 안내한다', () => {
  assert.equal(installPromptKind({ ...base, userAgent: IPAD_SAFARI }), 'ios-guide');
});

test('맥 사파리와 iOS 크롬은 사파리 안내 대상이 아니다', () => {
  assert.equal(isIosSafari(IPAD_SAFARI, 0), false);
  assert.equal(isIosSafari(IPHONE_CHROME, 5), false);
});

test('이미 앱으로 열었거나 네이티브 앱이면 띄우지 않는다', () => {
  assert.equal(installPromptKind({ ...base, hasDeferredPrompt: true, isStandalone: true }), null);
  assert.equal(installPromptKind({ ...base, hasDeferredPrompt: true, isNativePlatform: true }), null);
});

test('닫은 뒤 2주 동안은 띄우지 않는다', () => {
  const env = { ...base, hasDeferredPrompt: true };
  assert.equal(installPromptKind({ ...env, dismissedAt: base.now - 1000 }), null);
  assert.equal(installPromptKind({ ...env, dismissedAt: base.now - INSTALL_DISMISS_COOLDOWN_MS - 1 }), 'native-prompt');
});

test('첫 화면과 로그인·가입 흐름에서는 띄우지 않는다', () => {
  for (const path of ['/', '/login', '/signup', '/onboarding/parent', '/payment/checkout']) assert.equal(isQuietPath(path), true);
  assert.equal(isQuietPath('/parent'), false);
  assert.equal(isQuietPath('/tutor'), false);
});

test('동화를 읽는 화면과 내부 화면에서는 띄우지 않는다', () => {
  assert.equal(isQuietPath('/demo'), true);
  assert.equal(isQuietPath('/stories/hansel/play'), true);
  assert.equal(isQuietPath('/staff/hansel'), true);
  assert.equal(isQuietPath('/stories/hansel'), false);
  assert.equal(installPromptKind({ ...base, hasDeferredPrompt: true, pathname: '/demo' }), null);
});
