/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  browserFamilyFromUserAgent,
  platformClassFromUserAgent,
} from './client-diagnostics';

test('브라우저 진단은 원본 user agent 대신 거친 분류만 만든다', () => {
  assert.equal(
    browserFamilyFromUserAgent(
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36',
    ),
    'samsung-internet',
  );
  assert.equal(
    browserFamilyFromUserAgent(
      'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1',
    ),
    'safari',
  );
  assert.equal(
    browserFamilyFromUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
    ),
    'chrome',
  );
});

test('플랫폼 진단은 iPad 데스크톱 user agent도 터치 수로 구분한다', () => {
  assert.equal(
    platformClassFromUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Safari/605.1.15',
      5,
    ),
    'ipad',
  );
  assert.equal(
    platformClassFromUserAgent('Mozilla/5.0 (Linux; Android 14)', 5),
    'android',
  );
  assert.equal(
    platformClassFromUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)', 0),
    'mac',
  );
});
