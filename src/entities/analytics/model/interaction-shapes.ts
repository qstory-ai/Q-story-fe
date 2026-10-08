/**
 * 화면 사용 기록(누른 곳·스크롤·머뭇거림)에 쓰는 순수 함수 모음 - DOM·react-native를 읽지 않아 Node 테스트에서 바로 돈다.
 * 실제 화면 이벤트를 듣는 쪽은 interaction-tracker.ts.
 */

const UUID_LIKE = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

/** 경로 조각이 개별 id(UUID·초대 토큰·긴 숫자)인지 - 이야기 id 같은 짧은 이름은 화면 구분에 쓰려고 남긴다. */
function isIdSegment(segment: string) {
  if (UUID_LIKE.test(segment)) return true;
  if (/^\d{4,}$/.test(segment)) return true;
  return segment.length >= 16 && /\d/.test(segment);
}

/** 화면 이름 - 쿼리·해시를 빼고 id 조각은 :id로 바꾼다(같은 화면끼리 모아 보고, 주소의 개인 값은 남기지 않는다). */
export function normalizeScreenPath(pathname: string): string {
  const path = pathname.split(/[?#]/)[0] || '/';
  const segments = path.split('/').filter(Boolean).map((segment) => (isIdSegment(segment) ? ':id' : segment));
  return `/${segments.join('/')}`.slice(0, 120);
}

export const TARGET_LABEL_LIMIT = 80;

/** 눌린 요소 정보 - DOM에서 읽어 넘긴다. 입력칸의 값은 절대 넘기지 않는다. */
export type TargetSnapshot = {
  tag: string;
  role?: string | null;
  ariaLabel?: string | null;
  /** 요소 안 글자(innerText). 입력칸이면 무시한다. */
  text?: string | null;
  placeholder?: string | null;
};

const TEXT_ENTRY_TAGS = new Set(['input', 'textarea', 'select']);

function compact(value: string | null | undefined) {
  const text = (value ?? '').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, TARGET_LABEL_LIMIT) : null;
}

/**
 * 눌린 것의 이름 - aria-label이 먼저, 없으면 보이는 글자. 입력칸은 적힌 글자 대신 aria-label·placeholder만 쓴다
 * (아이·보호자가 입력한 글은 기록하지 않는다).
 */
export function targetLabelFrom(snapshot: TargetSnapshot): string | null {
  const label = compact(snapshot.ariaLabel);
  if (label) return label;
  if (TEXT_ENTRY_TAGS.has(snapshot.tag.toLowerCase())) return compact(snapshot.placeholder);
  return compact(snapshot.text);
}

/** 요소 종류 - role이 있으면 role, 없으면 태그 이름. */
export function targetRoleFrom(snapshot: TargetSnapshot): string {
  return (snapshot.role?.trim() || snapshot.tag).toLowerCase().slice(0, 32);
}

/** 화면 안 위치를 0..1로 - 기기 크기가 달라도 같은 자리끼리 모아 본다. */
export function normalizedPoint(value: number, size: number): number | null {
  if (!Number.isFinite(value) || !Number.isFinite(size) || size <= 0) return null;
  return Math.round(Math.min(1, Math.max(0, value / size)) * 1000) / 1000;
}

/** 스크롤 깊이(0..1) - 세로로 스크롤할 수 없는 상자(가로 목록 등)는 null로 빼서 최대값을 부풀리지 않는다. */
export function scrollDepthOf(scrollTop: number, clientHeight: number, scrollHeight: number): number | null {
  if (!(scrollHeight > clientHeight + 1) || clientHeight <= 0) return null;
  return Math.round(Math.min(1, Math.max(0, (scrollTop + clientHeight) / scrollHeight)) * 1000) / 1000;
}

export const HESITATION_IDLE_MS = 5_000;

export type Hesitation = { durationMs: number; lastTarget: string | null };

/**
 * 머뭇거림 감지 - 누르기·키·스크롤이 5초 넘게 없다가 다시 움직이면(또는 화면을 떠나면) 그 멈춘 길이를 돌려준다.
 * 화면이 가려진 동안은 화면을 떠난 것으로 보고 end()로 끊어, 가려진 시간은 멈춤에 넣지 않는다.
 */
export class HesitationDetector {
  private lastActivityAt: number;
  private lastTarget: string | null = null;

  constructor(now: number, private readonly idleMs = HESITATION_IDLE_MS) {
    this.lastActivityAt = now;
  }

  /** 움직임이 있을 때. target을 넘기면(누른 경우) 다음 멈춤의 "직전에 누른 것"이 된다. */
  activity(now: number, target?: string | null): Hesitation | null {
    const result = this.gapResult(now);
    this.lastActivityAt = now;
    if (target !== undefined) this.lastTarget = target;
    return result;
  }

  /** 화면을 떠날 때 - 끝나지 않은 멈춤도 남긴다. */
  end(now: number): Hesitation | null {
    const result = this.gapResult(now);
    this.lastActivityAt = now;
    return result;
  }

  /** 새 화면(또는 다시 보이기 시작) - 앞 화면의 멈춤과 섞지 않는다. 직전에 누른 것은 유지한다. */
  reset(now: number) {
    this.lastActivityAt = now;
  }

  private gapResult(now: number): Hesitation | null {
    const gap = now - this.lastActivityAt;
    return gap >= this.idleMs ? { durationMs: Math.round(gap), lastTarget: this.lastTarget } : null;
  }
}

export const SCROLL_EMIT_INTERVAL_MS = 3_000;

/** 화면별 최대 스크롤 깊이 - 바뀌었을 때만, 3초에 한 번까지 내보낸다. */
export class ScrollDepthTracker {
  private maxDepth = 0;
  private emittedDepth = 0;
  private lastEmitAt = Number.NEGATIVE_INFINITY;

  constructor(private readonly intervalMs = SCROLL_EMIT_INTERVAL_MS) {}

  get max() {
    return this.maxDepth;
  }

  /** 새 깊이를 보고 지금 보낼 값이 있으면 돌려준다. */
  observe(depth: number | null, now: number): number | null {
    if (depth !== null && depth > this.maxDepth) this.maxDepth = depth;
    if (this.maxDepth <= this.emittedDepth || now - this.lastEmitAt < this.intervalMs) return null;
    return this.markEmitted(now);
  }

  /** 아직 보내지 않은 깊이(화면을 떠날 때). */
  takePending(now: number): number | null {
    return this.maxDepth > this.emittedDepth ? this.markEmitted(now) : null;
  }

  reset() {
    this.maxDepth = 0;
    this.emittedDepth = 0;
    this.lastEmitAt = Number.NEGATIVE_INFINITY;
  }

  private markEmitted(now: number) {
    this.emittedDepth = this.maxDepth;
    this.lastEmitAt = now;
    return this.maxDepth;
  }
}

/** UTF-8 바이트 수 - keepalive 본문 한도(64KB)는 바이트 기준이다. */
export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * 항목들을 한 요청에 담을 수 있는 묶음으로 나눈다 - 묶음마다 maxItems개, maxBytes(JSON 기준)까지.
 * 혼자서 한도를 넘는 항목은 버린다(보낼 수 없다).
 */
export function splitByBudget<T>(items: readonly T[], maxBytes: number, maxItems: number): T[][] {
  const groups: T[][] = [];
  let current: T[] = [];
  let size = 0;
  for (const item of items) {
    const bytes = byteLength(JSON.stringify(item)) + 1;
    if (bytes > maxBytes) continue;
    if (current.length > 0 && (size + bytes > maxBytes || current.length >= maxItems)) {
      groups.push(current);
      current = [];
      size = 0;
    }
    current.push(item);
    size += bytes;
  }
  if (current.length > 0) groups.push(current);
  return groups;
}
