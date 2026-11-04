import { readEnv } from '@/shared/config';

const GOOGLE_CLIENT_ID = readEnv('VITE_GOOGLE_OAUTH_CLIENT_ID');
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

/** 빌드에 client-id가 없으면(아직 발급받기 전) 호출부가 버튼 자체를 숨긴다. */
export const googleOAuthConfigured = GOOGLE_CLIENT_ID.length > 0;

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
    script.onerror = () => reject(new Error('구글 로그인 스크립트를 불러오지 못했어요.'));
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

type GoogleCredentialResponse = { credential?: string };
type GoogleIdentityServices = {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void;
      renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
    };
  };
};

/**
 * Google Identity Services의 네이티브 버튼을 containerElement 안에 그려 넣고, 사용자가 그
 * 버튼으로 로그인을 마치면 onCredential(id_token)을 호출한다. One Tap(prompt())이 아니라
 * renderButton()을 쓰는 이유: One Tap은 사용자가 한 번 닫으면 지수적으로 늘어나는 쿨다운이
 * 걸려서 "버튼을 누르면 매번 뜬다"는 명시적 클릭 로그인 UX와 맞지 않는다 - 구글도 이런
 * 경우엔 renderButton을 권장한다.
 */
export async function renderGoogleButton(
  containerElement: HTMLElement,
  onCredential: (idToken: string) => void,
): Promise<void> {
  if (!googleOAuthConfigured) return;
  await loadScript();
  const google = (window as unknown as { google?: GoogleIdentityServices }).google;
  if (!google?.accounts?.id) return;
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (response) => {
      if (response.credential) onCredential(response.credential);
    },
  });
  google.accounts.id.renderButton(containerElement, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    shape: 'pill',
    width: 320,
    text: 'continue_with',
  });
}
