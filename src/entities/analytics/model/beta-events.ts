import { readEnv } from '@/shared/config';

import { currentClientDiagnostics } from './client-diagnostics';
import { UUID_PATTERN, createUuid, isHttpUrl } from './endpoint-utils';

const BETA_SESSION_STORAGE_KEY = 'qstory.beta.session.v1';

const ANALYTICS_URL = readEnv('VITE_QSTORY_ANALYTICS_URL');
const APP_VERSION = '0.1.0';
const TRAFFIC_TYPES = new Set(['beta', 'qa', 'dev']);

export type BetaEventName =
  | 'story_started'
  | 'scene_reached'
  | 'question_invite_shown'
  | 'question_skipped'
  | 'question_started'
  | 'choice_selected'
  | 'question_result'
  | 'playback_issue'
  | 'explicit_exit'
  | 'story_completed'
  | 'parent_report_opened'
  | 'survey_opened';

type BetaMetadata = Record<string, string | number | boolean>;

let memorySessionId: string | null = null;

export function trafficTypeForUrl(value: string | null | undefined) {
  if (!value) return 'beta';
  try {
    const url = new URL(value);
    const requested = url.searchParams.get('traffic_type');
    if (requested && TRAFFIC_TYPES.has(requested)) return requested;
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return 'dev';
    }
    if (url.hostname.endsWith('.vercel.app')) return 'qa';
  } catch {
    // URL을 해석하지 못하면 공개 베타 기본값을 사용한다.
  }
  return 'beta';
}

export function viewportClassForWidth(width: number | null) {
  if (width === null || !Number.isFinite(width)) return 'unknown';
  if (width <= 430) return 'mobile-compact';
  if (width <= 768) return 'mobile';
  if (width <= 1180) return 'tablet';
  return 'desktop';
}

function commonMetadata(): BetaMetadata {
  const width = typeof window === 'undefined' ? null : window.innerWidth;
  return {
    app_version: APP_VERSION,
    viewport_class: viewportClassForWidth(width),
    traffic_type: trafficTypeForUrl(
      typeof window === 'undefined' ? null : window.location.href,
    ),
    ...currentClientDiagnostics(),
  };
}

export const createBetaId = createUuid;

export function getBetaSessionId() {
  if (memorySessionId) return memorySessionId;

  if (typeof window !== 'undefined') {
    const fromUrl = new URL(window.location.href).searchParams.get('session_id');
    if (fromUrl && UUID_PATTERN.test(fromUrl)) {
      memorySessionId = fromUrl;
      try {
        globalThis.localStorage?.setItem(BETA_SESSION_STORAGE_KEY, fromUrl);
      } catch {
        // 분석 식별자 저장 실패는 체험을 막지 않는다.
      }
      return memorySessionId;
    }
  }

  try {
    const stored = globalThis.localStorage?.getItem(BETA_SESSION_STORAGE_KEY);
    if (stored && UUID_PATTERN.test(stored)) {
      memorySessionId = stored;
      return memorySessionId;
    }
  } catch {
    // 저장소가 없는 네이티브·개인정보 보호 환경에서는 메모리 세션을 사용한다.
  }

  memorySessionId = createBetaId();
  try {
    globalThis.localStorage?.setItem(BETA_SESSION_STORAGE_KEY, memorySessionId);
  } catch {
    // 비차단 조건이다.
  }
  return memorySessionId;
}

export async function trackBetaEvent(eventName: BetaEventName, metadata: BetaMetadata = {}) {
  if (!isHttpUrl(ANALYTICS_URL)) return Promise.resolve(false);

  const body = JSON.stringify({
    event_id: createBetaId(),
    session_id: getBetaSessionId(),
    event_name: eventName,
    source: 'player',
    occurred_at: new Date().toISOString(),
    metadata: { ...commonMetadata(), ...metadata },
    schema_version: 1,
  });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(ANALYTICS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (response.ok) return true;
      if (response.status < 500 && response.status !== 429) return false;
    } catch {
      // 한 번의 일시적 네트워크 실패는 같은 event_id로 안전하게 재시도한다.
    }
    if (attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  return false;
}
