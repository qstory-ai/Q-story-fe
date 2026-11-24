/**
 * 홈 화면 설치 안내를 띄울지 정한다. 브라우저에서 읽은 값만 받는 순수 함수라 테스트하기 쉽다.
 *
 * - 크롬 계열(갤럭시탭): 브라우저가 beforeinstallprompt 이벤트를 주면 "설치" 버튼으로 설치 창을 띄울 수 있다.
 * - 아이패드·아이폰 사파리: 설치 창을 띄우는 API가 없다. 공유 버튼으로 추가하는 방법만 안내한다.
 * - 이미 앱으로 열었거나, 네이티브 앱이거나, 닫은 지 얼마 안 됐으면 띄우지 않는다.
 */
export type InstallPromptKind = 'native-prompt' | 'ios-guide';

export const INSTALL_DISMISSED_KEY = 'qstory.pwaInstallDismissedAt';
/** 닫으면 2주 동안 다시 묻지 않는다. */
export const INSTALL_DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

export type InstallPromptEnv = {
  pathname: string;
  isNativePlatform: boolean;
  /** 홈 화면에서 앱으로 연 상태(display-mode: standalone 또는 iOS navigator.standalone). */
  isStandalone: boolean;
  /** 브라우저가 beforeinstallprompt를 줬는지. */
  hasDeferredPrompt: boolean;
  userAgent: string;
  maxTouchPoints: number;
  dismissedAt: number | null;
  now: number;
};

/** 첫 화면과 로그인·가입·결제 흐름. 아래쪽 버튼을 가리지 않게 여기서는 띄우지 않는다. */
const ENTRY_PATHS = ['/', '/tutorial', '/login', '/signup', '/join', '/reset-password', '/organization', '/homeroom-invite'];
const ENTRY_PREFIXES = ['/onboarding/', '/payment/', '/org-invite/'];

/** 진입·가입 흐름, 동화를 읽는 화면, 팀 내부 화면에서는 방해하지 않는다. */
export function isQuietPath(pathname: string): boolean {
  return (
    ENTRY_PATHS.includes(pathname) ||
    ENTRY_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    pathname === '/demo' ||
    /^\/stories\/[^/]+\/play$/.test(pathname) ||
    pathname === '/staff' ||
    pathname.startsWith('/staff/') ||
    pathname.startsWith('/internal/')
  );
}

/** iOS 사파리만 고른다. 크롬·카카오톡 같은 다른 앱 안 브라우저는 "홈 화면에 추가"가 없거나 위치가 다르다. */
export function isIosSafari(userAgent: string, maxTouchPoints: number): boolean {
  // 아이패드 사파리는 데스크톱 맥처럼 자기를 소개한다. 터치가 되면 아이패드다.
  const isIos = /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  if (!isIos) return false;
  if (!/Safari\//.test(userAgent)) return false;
  return !/CriOS|FxiOS|EdgiOS|OPiOS|KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\//i.test(userAgent);
}

export function installPromptKind(env: InstallPromptEnv): InstallPromptKind | null {
  if (env.isNativePlatform || env.isStandalone) return null;
  if (isQuietPath(env.pathname)) return null;
  if (env.dismissedAt !== null && env.now - env.dismissedAt < INSTALL_DISMISS_COOLDOWN_MS) return null;
  if (env.hasDeferredPrompt) return 'native-prompt';
  if (isIosSafari(env.userAgent, env.maxTouchPoints)) return 'ios-guide';
  return null;
}
