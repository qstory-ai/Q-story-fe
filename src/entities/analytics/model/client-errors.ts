import { apiBaseUrl } from '@/shared/config';

import { currentClientDiagnostics } from './client-diagnostics';

/**
 * 브라우저에서 난 에러를 백엔드(POST /v1/client-errors)로 보낸다 - 서버가 client.error 로그로 남기면
 * Grafana가 알림·대시보드로 본다(be ops/grafana-alerting). 서버가 받는 필드만 보내고, 아이 말·이름은
 * 넣지 않는다. 같은 에러는 한 번만, 한 화면에서 최대 MAX_REPORTS건만 보낸다.
 */
export type ClientErrorKind =
  | 'WINDOW_ERROR'
  | 'UNHANDLED_REJECTION'
  | 'PLAYBACK'
  | 'RUNTIME_FAILURE'
  | 'NETWORK'
  | 'RENDER';

export type ClientErrorReport = {
  kind: ClientErrorKind;
  message: string;
  stack?: string;
  storyId?: string;
  sceneId?: string;
};

export const MAX_REPORTS = 20;

/** 빌드 때 넣는 배포 표시(vite.config.ts의 VITE_QSTORY_RELEASE). 없으면 dev. */
const RELEASE = import.meta.env?.VITE_QSTORY_RELEASE?.trim() || 'dev';

const sentKeys = new Set<string>();

/** 서버로 보낼 본문. 주소는 경로만(쿼리에는 childId 같은 값이 있다), 스택은 앞부분만. */
export function clientErrorPayload(report: ClientErrorReport, pathname: string, browser: string) {
  return {
    kind: report.kind,
    message: report.message.slice(0, 300),
    ...(report.stack ? { stack: report.stack.slice(0, 1_200) } : {}),
    route: pathname.split('?')[0].slice(0, 80) || '/',
    ...(report.storyId ? { story_id: report.storyId } : {}),
    ...(report.sceneId ? { scene_id: report.sceneId } : {}),
    release: RELEASE,
    browser,
  };
}

/** 같은 종류·같은 문장은 한 번만, 전체 MAX_REPORTS건까지. 보내도 되면 true. */
export function shouldSendClientError(report: ClientErrorReport, sent: Set<string> = sentKeys) {
  if (sent.size >= MAX_REPORTS) return false;
  const key = `${report.kind}:${report.message.slice(0, 120)}`;
  if (sent.has(key)) return false;
  sent.add(key);
  return true;
}

export function reportClientError(report: ClientErrorReport) {
  if (!apiBaseUrl || typeof window === 'undefined' || !report.message) return;
  if (!shouldSendClientError(report)) return;
  const body = JSON.stringify(
    clientErrorPayload(report, window.location.pathname, currentClientDiagnostics().browser_family),
  );
  try {
    // keepalive - 페이지를 닫는 순간 난 에러도 보낸다. 실패해도 이용자에게 보이지 않는다.
    void fetch(`${apiBaseUrl}/v1/client-errors`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // 에러 보고가 다른 에러를 만들면 안 된다.
  }
}

/** 처리되지 않은 예외와 거부된 Promise를 잡는다. 앱 시작 때 한 번 부른다. */
export function installGlobalErrorReporting() {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (event) => {
    // 이미지·오디오 같은 자원 로드 실패는 event.error가 없다 - 그건 재생 쪽(PLAYBACK)에서 따로 보낸다.
    if (!event.error && !event.message) return;
    reportClientError({
      kind: 'WINDOW_ERROR',
      message: event.message || String(event.error),
      stack: event.error instanceof Error ? event.error.stack : undefined,
    });
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    // 사용자가 멈춘 요청(AbortError)은 에러가 아니다.
    if (reason instanceof Error && reason.name === 'AbortError') return;
    reportClientError({
      kind: 'UNHANDLED_REJECTION',
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });
}
