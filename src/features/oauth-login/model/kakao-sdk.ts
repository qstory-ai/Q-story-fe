import { readEnv } from '@/shared/config';

const KAKAO_JS_KEY = readEnv('VITE_KAKAO_JS_KEY');
const SCRIPT_SRC = 'https://developers.kakao.com/sdk/js/kakao.js';

/** 빌드에 JS 키가 없으면(아직 발급받기 전) 호출부가 버튼 자체를 숨긴다. */
export const kakaoOAuthConfigured = KAKAO_JS_KEY.length > 0;

let scriptLoadPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (scriptLoadPromise) return scriptLoadPromise;
  scriptLoadPromise = new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('카카오 로그인 스크립트를 불러오지 못했어요.'));
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

type KakaoAuthObj = { access_token: string };
type KakaoSdk = {
  isInitialized: () => boolean;
  init: (jsKey: string) => void;
  Auth: {
    login: (options: { success: (auth: KakaoAuthObj) => void; fail: (error: unknown) => void }) => void;
  };
};

function kakaoSdk(): KakaoSdk | undefined {
  return (window as unknown as { Kakao?: KakaoSdk }).Kakao;
}

/** 팝업으로 카카오 로그인을 열고, 발급된 access token을 반환한다 - 프로필 조회는 백엔드가 이 토큰으로 직접 한다(KakaoOAuthVerifier). */
export async function requestKakaoAccessToken(): Promise<string> {
  if (!kakaoOAuthConfigured) {
    throw new Error('카카오 로그인이 아직 설정되지 않았어요.');
  }
  await loadScript();
  const kakao = kakaoSdk();
  if (!kakao) {
    throw new Error('카카오 로그인을 불러오지 못했어요.');
  }
  if (!kakao.isInitialized()) {
    kakao.init(KAKAO_JS_KEY);
  }
  return new Promise<string>((resolve, reject) => {
    kakao.Auth.login({
      success: (auth) => resolve(auth.access_token),
      fail: (error) => reject(error instanceof Error ? error : new Error('카카오 로그인에 실패했어요.')),
    });
  });
}
