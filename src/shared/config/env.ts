// Vite는 `import.meta.env.VITE_X`처럼 정적으로 적힌 키만 그 값으로 바꾼다. `import.meta.env[key]`·
// `import.meta.env?.X`처럼 객체 자체를 건드리면 env 객체 전체(VITE_VERCEL_GIT_COMMIT_AUTHOR_LOGIN 같은
// Vercel 시스템 변수까지)가 번들에 통째로 들어간다 - 그래서 키마다 정적 접근을 따로 적는다.
// 순수 Node 실행 환경(예: `tsx --test`)에서는 `import.meta.env`가 `undefined`라 접근이 던지므로 try로 감싼다.
type EnvKey =
  | 'VITE_QSTORY_API_URL'
  | 'VITE_QSTORY_ANALYTICS_URL'
  | 'VITE_QSTORY_VOICE_RESEARCH_URL'
  | 'VITE_QSTORY_WEB_ORIGIN'
  | 'VITE_QSTORY_RELEASE'
  | 'VITE_GOOGLE_OAUTH_CLIENT_ID'
  | 'VITE_KAKAO_JS_KEY'
  | 'VITE_TOSS_CLIENT_KEY';

const readers: Record<EnvKey, () => string | undefined> = {
  VITE_QSTORY_API_URL: () => import.meta.env.VITE_QSTORY_API_URL,
  VITE_QSTORY_ANALYTICS_URL: () => import.meta.env.VITE_QSTORY_ANALYTICS_URL,
  VITE_QSTORY_VOICE_RESEARCH_URL: () => import.meta.env.VITE_QSTORY_VOICE_RESEARCH_URL,
  VITE_QSTORY_WEB_ORIGIN: () => import.meta.env.VITE_QSTORY_WEB_ORIGIN,
  VITE_QSTORY_RELEASE: () => import.meta.env.VITE_QSTORY_RELEASE,
  VITE_GOOGLE_OAUTH_CLIENT_ID: () => import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID,
  VITE_KAKAO_JS_KEY: () => import.meta.env.VITE_KAKAO_JS_KEY,
  VITE_TOSS_CLIENT_KEY: () => import.meta.env.VITE_TOSS_CLIENT_KEY,
};

export function readEnv(key: EnvKey): string {
  try {
    return readers[key]()?.trim() ?? '';
  } catch {
    return '';
  }
}

/** 개발 서버(vite dev)인지 - 빌드·Node 테스트에서는 false. */
export function isDevBuild(): boolean {
  try {
    return import.meta.env.DEV === true;
  } catch {
    return false;
  }
}

/** 백엔드 API 기본 주소 - entities의 api 모듈이 공유한다. */
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
