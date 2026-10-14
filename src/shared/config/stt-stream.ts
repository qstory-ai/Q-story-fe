import { apiBaseUrl, readEnv } from './env';

/**
 * 실시간 받아 적기(말하는 동안 받아 적어 멈추자마자 문장이 준비됨) 스위치. 문제가 생기면 false로 바꿔 배포하면
 * 녹음을 다 올려 받아 적는 기존 방식(배치)만 쓴다. 백엔드 STT_STREAM_ENABLED=false로도 끌 수 있다(표 발급 거절 → 배치).
 */
export const STT_STREAMING_ENABLED = true;

/** 웹 배포의 백엔드 직접 주소 - Vercel 프록시(/api/qstory)는 WebSocket을 들고 있지 못해 소켓만 백엔드에 직접 붙는다. */
const DEFAULT_WEB_STREAM_URL = 'wss://api.qstory.ai.kr/v1/stt/stream';
// 앞 슬래시 없이 둔다 - proxy-allowlist 테스트는 따옴표로 시작하는 v1 경로를 프록시 경로로 읽는데, 이 소켓은 프록시를 거치지 않는다.
const STREAM_PATH = 'v1/stt/stream';

/**
 * 실시간 받아 적기 WebSocket 주소. VITE_QSTORY_STT_STREAM_URL이 있으면 그것, 백엔드 주소가 절대 URL이면(앱 .env.native,
 * 로컬 개발) 그 주소의 ws(s) 판, 같은 출처 프록시면(웹 배포) 운영 백엔드 직접 주소.
 */
export function sttStreamUrl(configured = readEnv('VITE_QSTORY_STT_STREAM_URL'), base = apiBaseUrl): string {
  if (configured) return configured;
  if (/^https?:\/\//i.test(base)) {
    return `${base.replace(/\/+$/, '').replace(/^http/i, 'ws')}/${STREAM_PATH}`;
  }
  return DEFAULT_WEB_STREAM_URL;
}
