import { authorizationHeader } from '@/shared/api';
import { apiBaseUrl } from '@/shared/config';

import { getBetaSessionId } from './beta-events';
import {
  HesitationDetector,
  ScrollDepthTracker,
  normalizeScreenPath,
  normalizedPoint,
  scrollDepthOf,
  splitByBudget,
  targetLabelFrom,
  targetRoleFrom,
} from './interaction-shapes';

/**
 * 화면 사용 기록(POST /v1/interactions) - 모든 방문자의 화면 이동·누른 곳·스크롤·머뭇거림을 모아 5초마다 보낸다.
 * UT에서 "어디서 막혔는지"를 화면 녹화 없이도 숫자로 보려고 남긴다. 입력칸의 글자는 읽지 않는다.
 * 보내기는 화면을 막지 않고, 실패가 이어지면 조용히 버린다.
 */
export type InteractionKind = 'SCREEN_VIEW' | 'SCREEN_LEAVE' | 'TAP' | 'SCROLL' | 'HESITATION';

export type InteractionEvent = {
  kind: InteractionKind;
  occurredAt: string;
  screen: string;
  target?: string | null;
  targetRole?: string | null;
  x?: number | null;
  y?: number | null;
  viewportW?: number;
  viewportH?: number;
  scrollDepth?: number | null;
  durationMs?: number | null;
  metadata?: Record<string, string | number | boolean | null>;
};

const FLUSH_INTERVAL_MS = 5_000;
const FLUSH_AT_EVENTS = 50;
/** 서버가 한 번에 받는 최대 개수. */
const MAX_EVENTS_PER_REQUEST = 200;
/** 보내지 못해 쌓아 두는 최대 개수 - 넘으면 오래된 것부터 버린다. */
const MAX_QUEUE = 400;
/** 브라우저 keepalive 한도(64KB)는 녹화·에러 보고와 나눠 쓴다. */
const KEEPALIVE_BODY_BYTES = 24_000;
const MAX_CONSECUTIVE_FAILURES = 3;

const INTERACTIVE_SELECTOR = [
  'button',
  'a',
  '[role=button]',
  '[role=link]',
  '[role=tab]',
  '[role=radio]',
  '[role=checkbox]',
  '[role=switch]',
  'input',
  'textarea',
  'select',
  '[aria-label]',
].join(',');

let queue: InteractionEvent[] = [];
let playSessionId: string | null = null;
let playerPhase: string | null = null;
let consecutiveFailures = 0;
let disabled = false;
let sending = false;
let installed = false;

let screen: { path: string; name: string; startedAt: number } | null = null;
/** 가려지기 전 경로 - 다시 보이면 같은 화면을 새로 연 것으로 남긴다. */
let resumePath: string | null = null;
let hesitation: HesitationDetector | null = null;
const scroll = new ScrollDepthTracker();

/** 플레이어가 지금 회차 id를 넣는다 - 사용 기록·화면 녹화가 같은 회차에 이어진다. */
export function setInteractionPlaySessionId(id: string | null) {
  playSessionId = id;
}

export function currentInteractionPlaySessionId() {
  return playSessionId;
}

/** 플레이어 상태(낭독 중·질문 기다림 등) - 머뭇거림이 "듣고 있던 중"인지 가려 본다. */
export function setInteractionPlayerPhase(phase: string | null) {
  playerPhase = phase;
}

function viewport() {
  return { viewportW: window.innerWidth, viewportH: window.innerHeight };
}

function push(event: Omit<InteractionEvent, 'occurredAt' | 'screen'> & { screen?: string }) {
  if (disabled || !screen) return;
  queue.push({ occurredAt: new Date().toISOString(), screen: screen.name, ...viewport(), ...event });
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
  if (queue.length >= FLUSH_AT_EVENTS) void flushInteractions();
}

function pushHesitation(result: { durationMs: number; lastTarget: string | null } | null) {
  if (!result) return;
  push({
    kind: 'HESITATION',
    durationMs: result.durationMs,
    metadata: { lastTarget: result.lastTarget, ...(playerPhase ? { playerPhase } : {}) },
  });
}

function leaveScreen(reason: string) {
  if (!screen) return;
  const now = Date.now();
  pushHesitation(hesitation?.end(now) ?? null);
  const pendingDepth = scroll.takePending(now);
  if (pendingDepth !== null) push({ kind: 'SCROLL', scrollDepth: pendingDepth });
  push({ kind: 'SCREEN_LEAVE', durationMs: now - screen.startedAt, scrollDepth: scroll.max || null, metadata: { reason } });
  screen = null;
}

function enterScreen(path: string, reason: string) {
  const now = Date.now();
  screen = { path, name: normalizeScreenPath(path), startedAt: now };
  scroll.reset();
  hesitation ??= new HesitationDetector(now);
  hesitation.reset(now);
  push({ kind: 'SCREEN_VIEW', metadata: { reason } });
}

/** 경로가 바뀔 때마다 부른다(App의 UsageTracking). 같은 경로면 아무것도 하지 않는다. */
export function trackScreenChange(pathname: string) {
  if (typeof window === 'undefined' || disabled) return;
  if (screen?.path === pathname) return;
  leaveScreen('navigate');
  enterScreen(pathname, 'navigate');
}

function describeElement(element: Element) {
  const tag = element.tagName.toLowerCase();
  const isEntry = tag === 'input' || tag === 'textarea' || tag === 'select';
  const snapshot = {
    tag,
    role: element.getAttribute('role'),
    ariaLabel: element.getAttribute('aria-label'),
    // 입력칸은 글자를 읽지 않는다 - innerText 대신 빈 값.
    text: isEntry ? null : (element as HTMLElement).innerText,
    placeholder: element.getAttribute('placeholder'),
  };
  return { target: targetLabelFrom(snapshot), targetRole: targetRoleFrom(snapshot) };
}

function onPointerDown(event: PointerEvent) {
  try {
    const origin = event.target instanceof Element ? event.target : null;
    const interactive = origin?.closest(INTERACTIVE_SELECTOR) ?? null;
    // 누를 수 있는 것이 아니면 target은 null("화면 아무 곳").
    const described = interactive ? describeElement(interactive) : { target: null, targetRole: null };
    pushHesitation(hesitation?.activity(Date.now(), described.target ?? null) ?? null);
    push({
      kind: 'TAP',
      ...described,
      x: normalizedPoint(event.clientX, window.innerWidth),
      y: normalizedPoint(event.clientY, window.innerHeight),
      metadata: { pointerType: event.pointerType || null },
    });
  } catch {
    // 기록이 화면 조작을 방해하면 안 된다.
  }
}

/** 깊이 계산(레이아웃 읽기)은 250ms에 한 번만. */
let scrollMeasureQueued = false;
let lastScrollSource: EventTarget | null = null;

function onScroll(event: Event) {
  pushHesitation(hesitation?.activity(Date.now()) ?? null);
  lastScrollSource = event.target;
  if (scrollMeasureQueued) return;
  scrollMeasureQueued = true;
  setTimeout(() => {
    scrollMeasureQueued = false;
    try {
      const source = lastScrollSource;
      const element =
        source instanceof Element ? source : (document.scrollingElement ?? document.documentElement);
      const depth = scrollDepthOf(element.scrollTop, element.clientHeight, element.scrollHeight);
      const emit = scroll.observe(depth, Date.now());
      if (emit !== null) push({ kind: 'SCROLL', scrollDepth: emit });
    } catch {
      // 측정 실패는 무시한다.
    }
  }, 250);
}

function onActivity() {
  pushHesitation(hesitation?.activity(Date.now()) ?? null);
}

function onVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    // 가려진 동안은 화면을 떠난 것으로 본다 - 머무른 시간·머뭇거림에 넣지 않는다.
    const path = screen?.path ?? null;
    leaveScreen('hidden');
    resumePath = path;
    void flushInteractions({ keepalive: true });
  } else if (resumePath && !screen) {
    enterScreen(resumePath, 'resume');
    resumePath = null;
  }
}

function onPageHide() {
  const path = screen?.path ?? null;
  leaveScreen('pagehide');
  if (path) resumePath = path;
  void flushInteractions({ keepalive: true });
}

function endpoint() {
  return `${apiBaseUrl}/v1/interactions`;
}

async function post(events: InteractionEvent[], keepalive: boolean): Promise<'ok' | 'retry' | 'drop'> {
  try {
    const response = await fetch(endpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authorizationHeader() },
      body: JSON.stringify({ betaSessionId: getBetaSessionId(), playSessionId, events }),
      keepalive,
    });
    if (response.ok) return 'ok';
    // 4xx(429 제외)는 다시 보내도 같다 - 버린다.
    return response.status >= 500 || response.status === 429 ? 'retry' : 'drop';
  } catch {
    return 'retry';
  }
}

/** 쌓인 기록을 보낸다. keepalive면 페이지가 닫혀도 가도록 작게 나눠 보낸다. 절대 throw하지 않는다. */
export async function flushInteractions({ keepalive = false }: { keepalive?: boolean } = {}) {
  if (disabled || queue.length === 0 || (sending && !keepalive)) return;
  const pending = queue;
  queue = [];
  const groups = keepalive
    ? splitByBudget(pending, KEEPALIVE_BODY_BYTES, MAX_EVENTS_PER_REQUEST)
    : splitByBudget(pending, 900_000, MAX_EVENTS_PER_REQUEST);
  sending = true;
  try {
    for (let index = 0; index < groups.length; index += 1) {
      // keepalive 한도는 동시에 보내는 요청 합계다 - 첫 묶음만 keepalive, 나머지는 보통 요청으로.
      const result = await post(groups[index], keepalive && index === 0);
      if (result === 'ok') {
        consecutiveFailures = 0;
        continue;
      }
      if (result === 'retry') {
        consecutiveFailures += 1;
        if (consecutiveFailures < MAX_CONSECUTIVE_FAILURES) {
          queue = [...groups.slice(index).flat(), ...queue].slice(-MAX_QUEUE);
        } else {
          // 서버가 계속 받지 못하면 이 화면에서는 기록을 멈춘다(요청을 계속 쌓지 않게).
          disabled = true;
          queue = [];
        }
      }
      return;
    }
  } finally {
    sending = false;
  }
}

/** 앱 시작 때 한 번 - 문서 전체에서 듣는다(capture라 각 화면의 핸들러보다 먼저, 막지 않고). */
export function installInteractionTracking() {
  if (installed || typeof window === 'undefined' || typeof document === 'undefined' || !apiBaseUrl) return;
  installed = true;
  const passive = { capture: true, passive: true } as const;
  document.addEventListener('pointerdown', onPointerDown, passive);
  document.addEventListener('scroll', onScroll, passive);
  document.addEventListener('keydown', onActivity, passive);
  document.addEventListener('pointermove', onActivity, passive);
  document.addEventListener('touchstart', onActivity, passive);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', () => {
    if (resumePath && !screen && document.visibilityState === 'visible') {
      enterScreen(resumePath, 'resume');
      resumePath = null;
    }
  });
  setInterval(() => {
    void flushInteractions();
  }, FLUSH_INTERVAL_MS);
}
