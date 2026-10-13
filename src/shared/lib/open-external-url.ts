/**
 * 앱 밖 주소(메인 홈페이지 등)로 나간다.
 * 웹: 지금 탭이 그 주소로 이동한다.
 * 네이티브 셸(Capacitor): capacitor.config.ts의 allowNavigation이 비어 있어 바깥 호스트로의 이동은
 * Capacitor가 가로채 시스템 브라우저로 연다 - 앱(WebView)은 그대로 남는다. 그래서 네이티브면 true를
 * 돌려줘 호출하는 쪽이 앱 안 화면도 따로 옮기게 한다.
 */
export function openExternalUrl(url: string, isNative: boolean): { appStays: boolean } {
  if (typeof window === 'undefined') return { appStays: true };
  window.location.assign(url);
  return { appStays: isNative };
}
