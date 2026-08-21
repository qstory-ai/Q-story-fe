/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_QSTORY_API_URL?: string;
  readonly VITE_QSTORY_ANALYTICS_URL?: string;
  readonly VITE_QSTORY_VOICE_RESEARCH_URL?: string;
  readonly VITE_QSTORY_LANDING_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
