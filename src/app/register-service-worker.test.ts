// @ts-nocheck -- Node 테스트 러너 타입은 Expo 번들에서 의도적으로 제외한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldRegisterServiceWorker } from './register-service-worker';

const web = { isProductionBuild: true, mode: 'production', isNativePlatform: false, hasServiceWorker: true };

test('웹 배포본에서는 등록한다', () => {
  assert.equal(shouldRegisterServiceWorker(web), true);
});

test('개발 서버에서는 등록하지 않는다', () => {
  assert.equal(shouldRegisterServiceWorker({ ...web, isProductionBuild: false, mode: 'development' }), false);
});

test('네이티브 빌드와 네이티브 실행 환경에서는 등록하지 않는다', () => {
  assert.equal(shouldRegisterServiceWorker({ ...web, mode: 'native' }), false);
  assert.equal(shouldRegisterServiceWorker({ ...web, isNativePlatform: true }), false);
});

test('서비스 워커가 없는 브라우저에서는 등록하지 않는다', () => {
  assert.equal(shouldRegisterServiceWorker({ ...web, hasServiceWorker: false }), false);
});
