// `import.meta.env`는 빌드/개발 시점에 Vite가 주입한다. 순수 Node 실행 환경
// (예: `tsx --test`)에서는 `undefined`이므로, Vite 번들 밖에서도 이 모듈들을
// import할 수 있도록 여기서의 모든 접근은 optional chaining을 사용한다.
export function readEnv(key: keyof ImportMetaEnv): string {
  return import.meta.env?.[key]?.trim() ?? '';
}

/** entities 각 도메인의 api 모듈이 각자 readEnv('VITE_QSTORY_API_URL')를 반복하던 것을 여기로 모았다. */
export const apiBaseUrl = readEnv('VITE_QSTORY_API_URL');

/**
 * 사용자에게 건네는 링크(초대, 결제 복귀)의 출처. 웹에서는 지금 페이지의 출처이지만, 태블릿·폰
 * 네이티브 셸(Capacitor)에서는 페이지 출처가 실제로 열리는 주소가 아니라서(capacitor.config.ts의
 * server.hostname) .env.native의 VITE_QSTORY_WEB_ORIGIN으로 공개 웹 주소를 명시한다.
 */
export function webOrigin(): string {
  const configured = readEnv('VITE_QSTORY_WEB_ORIGIN').replace(/\/+$/, '');
  if (configured) return configured;
  return typeof window === 'undefined' ? '' : window.location.origin;
}
