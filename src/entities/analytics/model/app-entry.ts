import { trackBetaEvent, type BetaMetadataInput } from './beta-events';

/** 앱을 처음 연 경로 - UT에서 어떤 경로의 방문자가 가입·연결·사용으로 이어지는지 본다(Q-40). */
export type AppEntry = 'invite_link' | 'class_link' | 'direct' | 'notification' | 'report_link' | 'tutorial';

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const;
const ENTRY_GUARD_KEY = 'qstory.analytics.app-entry.v1';

/** 반 초대 링크로 들어왔는지 - 반 코드가 실린 주소. */
function classCodeOf(url: URL): string | null {
  return url.searchParams.get('code') ?? url.searchParams.get('classCode');
}

export function deriveAppEntry(href: string): { entry: AppEntry; path: string; hasClassCode: boolean } {
  const url = new URL(href);
  const path = url.pathname || '/';
  const hasClassCode = Boolean(classCodeOf(url));
  let entry: AppEntry = 'direct';
  if (url.searchParams.get('from') === 'notification') entry = 'notification';
  else if (path === '/join' || (hasClassCode && url.searchParams.get('flow') !== null)) entry = 'class_link';
  else if (path.startsWith('/org-invite') || path.startsWith('/tutor-invite')) entry = 'invite_link';
  else if (path.startsWith('/reports')) entry = 'report_link';
  else if (path === '/tutorial') entry = 'tutorial';
  return { entry, path, hasClassCode };
}

/** 주소의 utm 값 - 없으면 빈 값(보낼 때 빠진다). */
export function utmFromHref(href: string | null | undefined): BetaMetadataInput {
  if (!href) return {};
  const url = new URL(href);
  const utm: BetaMetadataInput = {};
  for (const key of UTM_KEYS) utm[key] = url.searchParams.get(key);
  return utm;
}

export function appEntryMetadata(href: string): BetaMetadataInput {
  const { entry, path, hasClassCode } = deriveAppEntry(href);
  return { entry, path, has_class_code: hasClassCode, ...utmFromHref(href) };
}

/** 탭(세션)당 한 번 - 새로고침해도 다시 보내지 않는다. 저장소가 없으면 이 화면 수명 동안 한 번. */
let sentInMemory = false;

export function trackAppEntryOnce() {
  if (typeof window === 'undefined' || sentInMemory) return;
  sentInMemory = true;
  try {
    if (globalThis.sessionStorage?.getItem(ENTRY_GUARD_KEY)) return;
    globalThis.sessionStorage?.setItem(ENTRY_GUARD_KEY, '1');
  } catch {
    // 저장소가 없으면 메모리 기준으로만 막는다.
  }
  void trackBetaEvent('app_entry', appEntryMetadata(window.location.href));
}

/** 생년으로 만 나이(대략) - 생일을 모르므로 올해 − 출생연도. 범위를 벗어나면 보내지 않는다. */
export function ageYearsFromBirthYear(birthYear: number | null | undefined, now: Date = new Date()): number | null {
  if (!birthYear || !Number.isFinite(birthYear)) return null;
  const age = now.getFullYear() - birthYear;
  return age >= 0 && age <= 18 ? age : null;
}

/**
 * 앱 안 경로에 `from=`(연 곳)을 붙인다 - 알림에서 연 리포트처럼 도착 화면이 통계에 출처를 남기게.
 * 바깥 주소이거나 이미 from이 있으면 그대로 둔다.
 */
export function hrefWithFrom(href: string, from: string): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  const url = new URL(href, 'https://app.invalid');
  if (url.searchParams.has('from')) return href;
  url.searchParams.set('from', from);
  return `${url.pathname}${url.search}${url.hash}`;
}
