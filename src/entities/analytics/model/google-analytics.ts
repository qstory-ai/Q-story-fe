import { readEnv } from '@/shared/config';

import type { BetaEventName, BetaMetadataInput } from './beta-events';
import { UUID_PATTERN } from './endpoint-utils';

/**
 * Google Analytics 4 (gtag.js) - 랜딩(qstory.ai.kr)·웹앱(demo.qstory.ai.kr)·태블릿 앱(Capacitor WebView)이
 * 같은 측정 ID로 화면 이동과 핵심 행동 몇 가지를 센다.
 *
 * 아동 서비스라 지키는 것:
 * - 광고 기능은 전부 끈다(google signals·광고 개인화·광고 저장소 동의 거부). 광고 ID·ATT를 쓰지 않는다.
 * - 이름·발화·이메일·계정/아이/반 id·초대 코드를 보내지 않는다. 주소는 경로 틀(`/org-invite/:token`)로 바꾸고
 *   쿼리는 utm만 남긴다. 이벤트 값은 이벤트별 허용 키의 짧은 분류값·숫자만 보낸다.
 * - "화면 이용 기록 수집"을 끈 기기·계정(recording-consent.ts의 trackingEnabled)에서는 gtag.js를 불러오지 않는다.
 *   불러온 뒤 끄면 `ga-disable-<ID>`로 전송을 멈추고 GA 쿠키를 지운다. 브라우저의 GPC·Do Not Track도 따른다.
 *
 * 자동 page_view는 끄고(SPA) 경로가 바뀔 때마다 UsageTracking이 trackGaPageView를 부른다.
 * 이 파일은 window가 없으면 아무것도 하지 않는다 - Node 테스트에서는 순수 함수만 쓴다.
 */

export const GA_MEASUREMENT_ID_DEFAULT = 'G-7PH6EEGDR3'; // 웹·앱 스트림 (랜딩은 G-79Z59DXLN3)
/** 랜딩 ↔ 앱이 같은 방문자로 이어지게(링커). 둘 다 qstory.ai.kr 쿠키를 함께 쓰지만, 주소 꾸밈(_gl)도 켜 둔다. */
export const GA_LINKER_DOMAINS = ['qstory.ai.kr', 'demo.qstory.ai.kr'];
/** 네이티브 앱의 WebView 출처는 실제로 열리는 주소가 아니라서(capacitor.config.ts) 보고서용 주소를 고정한다. */
const NATIVE_PAGE_ORIGIN = 'https://app.qstory.ai.kr';
const NATIVE_CLIENT_ID_KEY = 'qstory.ga.client-id.v1';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

export type GaPlatform = 'web' | 'ios' | 'android';

/**
 * 앱 경로 목록(App.tsx의 Route path와 같게 - google-analytics.test.ts가 맞는지 본다). `:이름` 자리는 그 이름으로 바꿔
 * 보내고, KEEP_SEGMENTS의 자리만 이야기·장면 id(콘텐츠 이름)를 그대로 둔다. 목록에 없는 주소는 `/(other)`.
 */
export const GA_ROUTE_TEMPLATES: readonly string[] = [
  '/',
  '/tutorial',
  '/onboarding/parent',
  '/onboarding/tutor',
  '/landing',
  '/demo',
  '/login',
  '/join',
  '/reset-password',
  '/signup',
  '/organization',
  '/parent',
  '/library',
  '/tutor',
  '/tutor/library',
  '/tutor/classes',
  '/tutor/classes/new',
  '/tutor/classes/:classId',
  '/tutor/lessons',
  '/tutor/class-groups',
  '/tutor/class-groups/new',
  '/tutor/class-groups/:classId',
  '/tutor/reports',
  '/tutor/join-organization',
  '/organization/tutors',
  '/organization/tutors/:tutorId',
  '/organization/classes',
  '/organization/classes/:classId',
  '/organization/classes/:classId/students/:studentId',
  '/organization/classes/:classId/term',
  '/organization/usage',
  '/organization/reports',
  '/organization/subscription',
  '/org-invite/code/:code',
  '/org-invite/:token',
  '/homeroom-invite',
  '/tutor/students',
  '/tutor/students/:studentId',
  '/tutor/lessons/:lessonId',
  '/mypage',
  '/mypage/account',
  '/mypage/subscription',
  '/payment/checkout',
  '/payment/success',
  '/payment/fail',
  '/mypage/delete-account',
  '/mypage/children',
  '/mypage/classes',
  '/mypage/settings',
  '/mypage/profile',
  '/mypage/notifications',
  '/mypage/privacy',
  '/mypage/support',
  '/reports',
  '/reports/:completionId',
  '/staff',
  '/staff/:storyId',
  '/staff/:storyId/scenes/:sceneId',
  '/stories/:storyId',
  '/stories/:storyId/play',
  '/internal/replay',
  '/internal/ui-kit',
];

const KEEP_SEGMENTS = new Set([':storyId', ':sceneId']);
/** 콘텐츠 id 모양(HG, scene-03) - 사람·계정 id(UUID, 긴 숫자)는 아니다. */
const CONTENT_ID = /^[A-Za-z][A-Za-z0-9_-]{0,40}$/;

const ROUTE_SEGMENTS = GA_ROUTE_TEMPLATES.map((template) => template.split('/').filter(Boolean));

function keepContentId(segment: string): boolean {
  return CONTENT_ID.test(segment) && !UUID_PATTERN.test(segment) && !/\d{6,}/.test(segment);
}

/** 앱 경로 → GA에 보낼 경로. 식별자 자리는 `:이름`, 모르는 경로는 `/(other)`. */
export function gaPagePath(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  for (const template of ROUTE_SEGMENTS) {
    if (template.length !== segments.length) continue;
    const out: string[] = [];
    let matched = true;
    for (let index = 0; index < template.length; index += 1) {
      const expected = template[index];
      const actual = segments[index];
      if (expected.startsWith(':')) {
        out.push(KEEP_SEGMENTS.has(expected) && keepContentId(actual) ? actual : expected);
      } else if (expected === actual) {
        out.push(actual);
      } else {
        matched = false;
        break;
      }
    }
    if (matched) return `/${out.join('/')}`;
  }
  return '/(other)';
}

/** 주소의 utm 쿼리만(GA 트래픽 획득용). 값은 짧게 자른다. */
export function gaUtmQuery(href: string | null | undefined): string {
  if (!href) return '';
  try {
    const source = new URL(href).searchParams;
    const kept = new URLSearchParams();
    for (const key of UTM_KEYS) {
      const value = source.get(key)?.trim().slice(0, 80);
      if (value) kept.set(key, value);
    }
    const query = kept.toString();
    return query ? `?${query}` : '';
  } catch {
    return '';
  }
}

/** page_referrer - 다른 사이트는 출처만, 같은 사이트는 경로 틀로. */
export function gaReferrer(referrer: string | null | undefined, currentOrigin: string): string | undefined {
  if (!referrer) return undefined;
  try {
    const url = new URL(referrer);
    if (url.origin === currentOrigin) return `${url.origin}${gaPagePath(url.pathname)}`;
    return `${url.origin}/`;
  } catch {
    return undefined;
  }
}

// ---- 이벤트 ------------------------------------------------------------------------------------------

export type GaEventName =
  | 'cta_click'
  | 'launch_notify_submit'
  | 'sign_up'
  | 'login'
  | 'story_start'
  | 'story_complete'
  | 'gretel_open'
  | 'help_request'
  | 'report_open';

const GA_EVENT_NAMES: ReadonlySet<GaEventName> = new Set<GaEventName>([
  'cta_click',
  'launch_notify_submit',
  'sign_up',
  'login',
  'story_start',
  'story_complete',
  'gretel_open',
  'help_request',
  'report_open',
]);

type GaParams = Record<string, string | number>;

/** 이벤트별로 보낼 수 있는 키 - 여기 없는 키(아이·계정·회차 id 등)는 버린다. */
const GA_EVENT_KEYS: Record<GaEventName, readonly string[]> = {
  cta_click: ['cta_location'],
  launch_notify_submit: ['wants_contact'],
  sign_up: ['role', 'method'],
  login: ['role'],
  story_start: ['resume', 'entry_source', 'play_setting', 'story_version'],
  story_complete: ['duration_seconds', 'question_count', 'changed_scene_count', 'story_version'],
  gretel_open: ['entry_mode'],
  help_request: ['help_step'],
  report_open: ['kind', 'source', 'viewer_role'],
};

/** 분류값 모양(영문·숫자·_-.:) 40자까지만 - 그 밖의 글자(이름·문장)는 보내지 않는다. */
const CATEGORY_VALUE = /^[A-Za-z0-9_.:-]{1,40}$/;

export function shapeGaParams(eventName: GaEventName, input: BetaMetadataInput): GaParams {
  const params: GaParams = {};
  for (const key of GA_EVENT_KEYS[eventName]) {
    const value = input[key];
    if (typeof value === 'number') {
      if (Number.isFinite(value)) params[key] = value;
    } else if (typeof value === 'boolean') {
      params[key] = value ? 'true' : 'false';
    } else if (typeof value === 'string') {
      const text = value.trim();
      if (CATEGORY_VALUE.test(text)) params[key] = text.toLowerCase();
    }
  }
  return params;
}

/** 자체 통계 이벤트 중 GA에도 보낼 것 → GA 이벤트 이름. null이면 보내지 않는다. */
export function gaEventForBetaEvent(eventName: BetaEventName, metadata: BetaMetadataInput): GaEventName | null {
  switch (eventName) {
    case 'landing_cta_click':
      return 'cta_click';
    case 'signup_completed':
      return 'sign_up';
    case 'story_started':
      return 'story_start';
    case 'story_completed':
      return 'story_complete';
    case 'dialogue_step':
      if (metadata.turn_kind === 'OPEN') return 'gretel_open';
      if (metadata.turn_kind === 'HELP') return 'help_request';
      return null;
    case 'report_viewed':
    case 'parent_report_opened':
      return 'report_open';
    default:
      return null;
  }
}

// ---- 전송 직전 점검 -----------------------------------------------------------------------------------
// gtag.js의 향상된 측정(Enhanced measurement)은 코드로 끌 수 없다 - "브라우저 기록 변경에 따른 페이지 변경"이 켜져 있으면
// send_page_view:false여도 라우트가 바뀔 때 실제 주소(초대 토큰 등)를 담은 page_view를 따로 보내고, page_referrer에도
// 첫 주소(쿼리 포함)를 싣는다. 그래서 GA로 나가는 요청(/g/collect)을 보내기 직전에 한 번 더 고친다:
// 주소(dl)·리퍼러(dr)·제목(dt)을 경로 틀로 바꾸고, 우리가 보내지 않은 page_view와 허용하지 않은 자동 이벤트는 뺀다.

const GA_HIT_HOST = /(^|\.)(google-analytics\.com|analytics\.google\.com)$/;
/** gtag가 스스로 보내는 이벤트 중 남길 것 - 머문 시간(user_engagement)과 스크롤 깊이. 클릭·폼·검색어 이벤트는 뺀다. */
const AUTO_EVENTS_KEPT = new Set(['user_engagement', 'scroll']);

export function isGaHitUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return GA_HIT_HOST.test(url.hostname) && url.pathname.endsWith('/collect');
  } catch {
    return false;
  }
}

/** 보고서에 쓸 주소 - 경로 틀 + utm 쿼리만. 네이티브 출처는 고정 주소로. */
export function gaHitLocation(value: string, originOverride?: string): string {
  try {
    const url = new URL(value);
    return `${originOverride ?? url.origin}${gaPagePath(url.pathname)}${gaUtmQuery(url.href)}`;
  } catch {
    return `${originOverride ?? ''}/(other)`;
  }
}

function keepHitEvent(params: URLSearchParams, shared: URLSearchParams): boolean {
  const eventName = params.get('en');
  if (!eventName) return true;
  // 우리가 보내는 page_view에는 qs_surface가 있다 - 없는 것은 기록 변경으로 gtag가 따로 보낸 것.
  if (eventName === 'page_view') return params.has('ep.qs_surface') || shared.has('ep.qs_surface');
  return AUTO_EVENTS_KEPT.has(eventName) || (GA_EVENT_NAMES as ReadonlySet<string>).has(eventName);
}

function scrubHitParams(params: URLSearchParams, siteOrigin: string, originOverride?: string) {
  const location = params.get('dl');
  if (location) {
    const cleaned = gaHitLocation(location, originOverride);
    params.set('dl', cleaned);
    params.set('dt', new URL(cleaned).pathname);
  } else if (params.has('dt')) {
    params.delete('dt');
  }
  const referrer = params.get('dr');
  if (referrer) {
    const cleaned = gaReferrer(referrer, siteOrigin);
    if (cleaned) params.set('dr', cleaned);
    else params.delete('dr');
  }
}

/**
 * GA 요청 하나를 고친다. 보낼 이벤트가 하나도 남지 않으면 null(보내지 않는다).
 * 요청 주소의 쿼리는 공통 값(이벤트 하나면 그 이벤트까지), 본문은 줄마다 이벤트 하나다.
 */
export function scrubGaHit(
  url: string,
  body: string | null,
  { siteOrigin, originOverride }: { siteOrigin: string; originOverride?: string },
): { url: string; body: string | null } | null {
  const parsed = new URL(url);
  const shared = parsed.searchParams;
  if (!keepHitEvent(shared, new URLSearchParams())) return null;
  scrubHitParams(shared, siteOrigin, originOverride);
  let nextBody = body;
  if (body) {
    const lines = body
      .split('\n')
      .filter(Boolean)
      .map((line) => new URLSearchParams(line))
      .filter((line) => keepHitEvent(line, shared));
    if (lines.length === 0 && !shared.has('en')) return null;
    for (const line of lines) scrubHitParams(line, siteOrigin, originOverride);
    nextBody = lines.map((line) => line.toString()).join('\n');
  }
  return { url: parsed.toString(), body: nextBody };
}

let scrubberInstalled = false;

/** fetch·sendBeacon·이미지 픽셀로 나가는 GA 요청만 scrubGaHit을 거치게 한다. 다른 요청은 그대로 지나간다. */
function installHitScrubber() {
  const w = gaWindow();
  if (!w || scrubberInstalled) return;
  scrubberInstalled = true;
  const options = () => ({
    siteOrigin: w.location.origin,
    originOverride: gaPlatform() === 'web' ? undefined : NATIVE_PAGE_ORIGIN,
  });

  const originalFetch = w.fetch?.bind(w);
  if (originalFetch) {
    w.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const target = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (!isGaHitUrl(target)) return originalFetch(input, init);
      const body = init?.body ?? null;
      const scrubbed = typeof body === 'string' || body === null ? scrubGaHit(target, body, options()) : null;
      if (!scrubbed) return Promise.resolve(new Response(null, { status: 204 }));
      return originalFetch(scrubbed.url, { ...init, body: scrubbed.body ?? undefined });
    };
  }

  const nav = typeof navigator === 'undefined' ? null : navigator;
  const originalBeacon = nav?.sendBeacon?.bind(nav);
  if (nav && originalBeacon) {
    nav.sendBeacon = (target: string | URL, data?: BodyInit | null) => {
      const href = typeof target === 'string' ? target : target.href;
      if (!isGaHitUrl(href)) return originalBeacon(target, data);
      const body = data ?? null;
      const scrubbed = typeof body === 'string' || body === null ? scrubGaHit(href, body, options()) : null;
      if (!scrubbed) return true;
      return originalBeacon(scrubbed.url, scrubbed.body ?? undefined);
    };
  }

  const imageSrc = typeof HTMLImageElement === 'undefined'
    ? undefined
    : Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  if (imageSrc?.set && imageSrc.get) {
    const setSrc = imageSrc.set;
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      ...imageSrc,
      set(this: HTMLImageElement, value: string) {
        if (typeof value === 'string' && isGaHitUrl(value)) {
          const scrubbed = scrubGaHit(value, null, options());
          if (!scrubbed) return;
          setSrc.call(this, scrubbed.url);
          return;
        }
        setSrc.call(this, value);
      },
    });
  }
}

// ---- 실행 상태 -----------------------------------------------------------------------------------------

type GtagWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  Capacitor?: { getPlatform?: () => string };
} & Record<string, unknown>;

function gaWindow(): GtagWindow | null {
  return typeof window === 'undefined' ? null : (window as unknown as GtagWindow);
}

export function gaPlatform(): GaPlatform {
  const platform = gaWindow()?.Capacitor?.getPlatform?.();
  return platform === 'ios' || platform === 'android' ? platform : 'web';
}

function measurementId(): string | null {
  const configured = readEnv('VITE_GA_MEASUREMENT_ID');
  if (configured === 'off') return null;
  return configured || GA_MEASUREMENT_ID_DEFAULT;
}

/** 개발 서버(localhost)는 `?ga_debug=1`로 열 때만 보낸다 - 그때는 GA DebugView에 뜬다. */
function isLocalHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function browserOptedOut(): boolean {
  const nav = typeof navigator === 'undefined' ? null : (navigator as Navigator & { globalPrivacyControl?: boolean });
  return nav?.globalPrivacyControl === true || nav?.doNotTrack === '1';
}

function trafficType(hostname: string, debug: boolean): string {
  if (debug || isLocalHost(hostname)) return 'dev';
  if (hostname.endsWith('.vercel.app')) return 'qa';
  return 'beta';
}

const state = {
  entryHref: null as string | null,
  wanted: false,
  loaded: false,
  currentPath: null as string | null,
  sentPath: null as string | null,
  firstPageSent: false,
};

/** 앱을 연 주소 - 라우터가 주소를 바꾸기 전에(utm·ga_debug를 읽으려고) 한 번 넣는다. */
export function setGaEntryHref(href: string | null) {
  state.entryHref ??= href;
}

function debugRequested(): boolean {
  try {
    return state.entryHref ? new URL(state.entryHref).searchParams.get('ga_debug') === '1' : false;
  } catch {
    return false;
  }
}

/** 이 화면에서 GA를 쓸 수 있는지(측정 ID·브라우저 거부·개발 서버). 사용자의 기록 설정은 따로 본다. */
function gaAvailable(): string | null {
  const w = gaWindow();
  if (!w) return null;
  const id = measurementId();
  if (!id || browserOptedOut()) return null;
  if (isLocalHost(w.location.hostname) && !debugRequested()) return null;
  return id;
}

function pageOrigin(): string {
  const w = gaWindow();
  if (!w) return '';
  if (gaPlatform() !== 'web') return NATIVE_PAGE_ORIGIN;
  return w.location.origin;
}

function nativeClientId(): string {
  const created = `${Math.floor(Math.random() * 2_147_483_647)}.${Math.floor(Date.now() / 1000)}`;
  try {
    const stored = globalThis.localStorage?.getItem(NATIVE_CLIENT_ID_KEY);
    if (stored && /^\d+\.\d+$/.test(stored)) return stored;
    globalThis.localStorage?.setItem(NATIVE_CLIENT_ID_KEY, created);
  } catch {
    // 저장소가 없으면 이번 실행 동안만 쓰는 값.
  }
  return created;
}

function commonParams(): GaParams {
  const w = gaWindow();
  return {
    qs_platform: gaPlatform(),
    qs_surface: 'app',
    traffic_type: trafficType(w?.location.hostname ?? '', debugRequested()),
  };
}

function gtag(...args: unknown[]) {
  gaWindow()?.gtag?.(...args);
}

function loadGtag(id: string) {
  const w = gaWindow();
  if (!w || state.loaded) return;
  state.loaded = true;
  installHitScrubber();
  w.dataLayer = w.dataLayer ?? [];
  // gtag.js는 arguments 객체 그대로를 받는다(배열로 바꾸면 명령으로 읽지 않는다).
  w.gtag = function gtagShim() {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer?.push(arguments);
  };
  const platform = gaPlatform();
  const native = platform !== 'web';
  const debug = debugRequested();
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    personalization_storage: 'denied',
    functionality_storage: 'denied',
    analytics_storage: 'granted',
  });
  gtag('set', 'ads_data_redaction', true);
  gtag('js', new Date());
  const origin = pageOrigin();
  const path = gaPagePath(state.currentPath ?? w.location.pathname);
  gtag('config', id, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    page_location: `${origin}${path}`,
    page_title: path,
    page_referrer: gaReferrer(typeof document === 'undefined' ? null : document.referrer, w.location.origin),
    linker: { domains: GA_LINKER_DOMAINS },
    // 웹은 qstory.ai.kr 쿠키(랜딩과 공유). 네이티브 WebView(특히 iOS capacitor://)는 쿠키를 믿을 수 없어 쿠키 없이
    // 이 기기에 저장한 임의의 client_id를 쓴다.
    ...(native
      ? { client_storage: 'none', client_id: nativeClientId() }
      : w.location.protocol === 'https:'
        ? { cookie_flags: 'SameSite=None;Secure' }
        : {}),
    user_properties: { qs_platform: platform, qs_surface: 'app' },
    ...(debug ? { debug_mode: true } : {}),
  });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);
}

/** 기기·주소에 남은 GA 식별값(_ga 쿠키, 네이티브 client_id)을 지운다 - 기록 수집을 끈 뒤. */
function clearGaIdentifiers() {
  const w = gaWindow();
  if (!w || typeof document === 'undefined') return;
  const names = document.cookie
    .split(';')
    .map((part) => part.split('=')[0]?.trim())
    .filter((name): name is string => Boolean(name) && (name === '_ga' || name.startsWith('_ga_')));
  const labels = w.location.hostname.split('.');
  const domains = labels.map((_, index) => labels.slice(index).join('.')).filter((domain) => domain.includes('.'));
  for (const name of names) {
    document.cookie = `${name}=; Max-Age=0; path=/`;
    for (const domain of domains) document.cookie = `${name}=; Max-Age=0; path=/; domain=.${domain}`;
  }
  try {
    globalThis.localStorage?.removeItem(NATIVE_CLIENT_ID_KEY);
  } catch {
    // 지우지 못해도 전송은 이미 멈췄다.
  }
}

function sendPageView() {
  const w = gaWindow();
  if (!w || !state.currentPath) return;
  const path = gaPagePath(state.currentPath);
  if (state.sentPath === path) return;
  state.sentPath = path;
  // 첫 화면에만 utm을 싣는다 - GA가 방문 경로(트래픽 획득)를 이 값으로 잡는다.
  const query = state.firstPageSent ? '' : gaUtmQuery(state.entryHref);
  state.firstPageSent = true;
  const location = `${pageOrigin()}${path}${query}`;
  gtag('set', { page_location: location, page_title: path });
  gtag('event', 'page_view', { page_location: location, page_title: path, ...commonParams() });
}

/**
 * 사용자의 "화면 이용 기록 수집" 설정 - UsageTracking이 설정을 확인한 뒤(로그인했으면 계정 설정까지) 넣는다.
 * true가 되기 전에는 gtag.js를 불러오지 않는다.
 */
export function setGoogleAnalyticsEnabled(enabled: boolean) {
  const w = gaWindow();
  const id = gaAvailable();
  if (!w || !id) return;
  if (enabled === state.wanted) return;
  state.wanted = enabled;
  if (enabled) {
    w[`ga-disable-${id}`] = false;
    if (state.loaded) gtag('consent', 'update', { analytics_storage: 'granted' });
    else loadGtag(id);
    state.sentPath = null;
    sendPageView();
    return;
  }
  if (!state.loaded) return;
  w[`ga-disable-${id}`] = true;
  gtag('consent', 'update', { analytics_storage: 'denied' });
  clearGaIdentifiers();
}

/** 화면(경로)이 바뀔 때마다 - 기록이 꺼져 있으면 경로만 기억해 둔다(켜지면 그 화면부터 보낸다). */
export function trackGaPageView(pathname: string) {
  state.currentPath = pathname;
  if (state.wanted && state.loaded) sendPageView();
}

export function trackGaEvent(eventName: GaEventName, metadata: BetaMetadataInput = {}) {
  if (!state.wanted || !state.loaded) return;
  gtag('event', eventName, { ...shapeGaParams(eventName, metadata), ...commonParams() });
}

/** 자체 통계 이벤트(trackBetaEvent) 중 GA 핵심 이벤트에 해당하는 것을 함께 보낸다. */
export function forwardBetaEventToGa(eventName: BetaEventName, metadata: BetaMetadataInput) {
  const gaEvent = gaEventForBetaEvent(eventName, metadata);
  if (!gaEvent) return;
  trackGaEvent(gaEvent, eventName === 'parent_report_opened' ? { source: 'story_end', ...metadata } : metadata);
}
