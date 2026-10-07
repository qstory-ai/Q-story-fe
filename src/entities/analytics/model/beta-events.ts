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
  | 'survey_opened'
  | 'dialogue_step'
  // 공개 소개 화면(랜딩·튜토리얼) - 서버의 LANDING_VIEW·LANDING_CTA_CLICK(source LANDING).
  | 'landing_view'
  | 'landing_cta_click'
  // Q-40 UT: 플레이어 밖 앱 화면(진입·가입·반 연결·동의·리포트)과 재생 조작.
  | 'app_entry'
  | 'signup_started'
  | 'signup_completed'
  | 'child_registered'
  | 'class_join'
  | 'consent_saved'
  | 'playback_control'
  | 'report_viewed'
  | 'report_action';

/** 서버 EventName의 source - 앱 화면 이벤트는 APP, 이야기 플레이어 안 이벤트는 PLAYER. */
const APP_SOURCE_EVENTS: ReadonlySet<BetaEventName> = new Set<BetaEventName>([
  'app_entry',
  'signup_started',
  'signup_completed',
  'child_registered',
  'class_join',
  'consent_saved',
  'report_viewed',
  'report_action',
]);

const LANDING_SOURCE_EVENTS: ReadonlySet<BetaEventName> = new Set<BetaEventName>(['landing_view', 'landing_cta_click']);

export function betaEventSource(eventName: BetaEventName): 'app' | 'player' | 'landing' {
  if (LANDING_SOURCE_EVENTS.has(eventName)) return 'landing';
  return APP_SOURCE_EVENTS.has(eventName) ? 'app' : 'player';
}

type BetaMetadata = Record<string, string | number | boolean>;
/** 호출부는 값이 없을 수 있는 키를 그대로 넘긴다 - 빈 값은 보내기 전에 뺀다(서버가 빈 문자열을 거부). */
export type BetaMetadataInput = Record<string, string | number | boolean | null | undefined>;

/** 서버가 짧은 값은 80자까지 받는다. 질문 원문 키만 서버에서 따로 길이를 다룬다. */
const MAX_VALUE_LENGTH = 80;
const LONG_TEXT_KEYS = new Set(['question_text', 'question_intent']);

/**
 * 로그인한 상태면 통계 요청에 토큰을 실어 서버가 이 통계 세션을 계정에 연결하게 한다(Q-40 UT, 참여자별로 이어 보기).
 * AuthProvider가 로그인 상태가 바뀔 때마다 넣어 준다 - 통계는 인증 모듈을 직접 읽지 않는다.
 */
let betaAuthToken: string | null = null;

export function setBetaEventAuthToken(token: string | null) {
  betaAuthToken = token;
}

/** 빈 값(null·undefined·빈 문자열·NaN)은 빼고, 짧은 값은 80자로 자른다. */
export function shapeBetaMetadata(metadata: BetaMetadataInput): BetaMetadata {
  const shaped: BetaMetadata = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'number') {
      if (Number.isFinite(value)) shaped[key] = value;
      continue;
    }
    if (typeof value === 'string') {
      const text = value.trim();
      if (!text) continue;
      shaped[key] = LONG_TEXT_KEYS.has(key) ? text : text.slice(0, MAX_VALUE_LENGTH);
      continue;
    }
    shaped[key] = value;
  }
  return shaped;
}

/** 요청 헤더 - 토큰이 있으면 Authorization을 붙인다. */
export function betaEventHeaders(token: string | null): Record<string, string> {
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
}

/** 실패를 통계용 오류 코드로 - 서버 code, 없으면 HTTP 상태, 그것도 없으면 UNKNOWN. 메시지 원문은 보내지 않는다. */
export function betaErrorCode(failure: unknown): string {
  const error = failure as { code?: unknown; status?: unknown } | null;
  if (error && typeof error.code === 'string' && error.code) return error.code;
  if (error && typeof error.status === 'number') return `HTTP_${error.status}`;
  return 'UNKNOWN';
}

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

export async function trackBetaEvent(eventName: BetaEventName, metadata: BetaMetadataInput = {}) {
  if (!isHttpUrl(ANALYTICS_URL)) return Promise.resolve(false);

  const body = JSON.stringify({
    event_id: createBetaId(),
    session_id: getBetaSessionId(),
    event_name: eventName,
    source: betaEventSource(eventName),
    occurred_at: new Date().toISOString(),
    metadata: shapeBetaMetadata({ ...commonMetadata(), ...metadata }),
    schema_version: 1,
  });
  const headers = betaEventHeaders(betaAuthToken);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(ANALYTICS_URL, {
        method: 'POST',
        headers,
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
