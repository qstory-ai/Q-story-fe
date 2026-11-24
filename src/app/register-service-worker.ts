/**
 * 웹 배포본에서만 서비스 워커(public/sw.js)를 등록한다. 홈 화면 설치와 오프라인 앱 틀을 맡는다.
 * 개발 서버에서는 캐시가 HMR을 가리고, 네이티브 앱(Capacitor)은 파일을 앱 안에 이미 갖고 있어 등록하지 않는다.
 */
type RegisterEnv = {
  isProductionBuild: boolean;
  mode: string;
  isNativePlatform: boolean;
  hasServiceWorker: boolean;
};

export function shouldRegisterServiceWorker(env: RegisterEnv): boolean {
  return env.isProductionBuild && env.mode !== 'native' && !env.isNativePlatform && env.hasServiceWorker;
}

export function installServiceWorker(isNativePlatform: boolean): void {
  const enabled = shouldRegisterServiceWorker({
    isProductionBuild: import.meta.env.PROD,
    mode: import.meta.env.MODE,
    isNativePlatform,
    hasServiceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
  });
  if (!enabled) return;
  // 첫 화면을 그리는 요청과 겹치지 않게 load 뒤에 등록한다. 실패해도 앱은 그대로 돈다.
  const register = () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error: unknown) => {
      console.warn('[sw] 등록 실패', error);
    });
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
