/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_QSTORY_API_URL?: string;
  readonly VITE_QSTORY_ANALYTICS_URL?: string;
  readonly VITE_QSTORY_VOICE_RESEARCH_URL?: string;
  readonly VITE_QSTORY_LANDING_URL?: string;
  /** 공개 식별자 - 비밀값이 아니다(Google Identity Services 초기화에 그대로 노출된다). */
  readonly VITE_GOOGLE_OAUTH_CLIENT_ID?: string;
  /** 카카오 JS 키 - 이것도 공개 식별자다(REST API 키와 달리 클라이언트에 노출되도록 만들어졌다). */
  readonly VITE_KAKAO_JS_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
