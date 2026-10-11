/**
 * 다시 보기 전에 녹화 이벤트에서 바깥 주소를 지운다. 녹화는 브라우저가 올린 것이라 내용을 믿을 수 없다 -
 * 그대로 재생하면 <img src="https://남의서버/...">·CSS url(...) 같은 것이 보는 사람(팀원) 브라우저에서
 * 바깥으로 요청을 보낸다(열람 사실·IP 노출). 허용한 출처(우리 앱·스토리 자산 저장소)와 data:/blob:만 남기고
 * 나머지 주소는 지운다 - 주소 속성은 빼고, CSS url()은 빈 data: 주소로, 바깥 @import는 무효 규칙으로 바꾼다
 * (어느 쪽도 요청을 만들지 않는다). 재생 iframe은 스크립트를 못 돌리고(sandbox="allow-same-origin"),
 * 페이지 CSP도 막지만 이것이 첫 번째 방어선이다.
 *
 * rrweb 이벤트 모양에 기대지 않고 이벤트 트리 전체를 돈다:
 * - `attributes` 객체(첫 화면 스냅숏의 요소 노드, 변경 이벤트의 속성 변경) 안의 주소 속성은 주소 규칙으로,
 * - 그 밖의 모든 문자열(스타일 텍스트, CSS 규칙, 스타일 선언 값 등)은 CSS 규칙으로 고친다.
 */

/** 스토리 삽화·내레이션이 있는 Supabase 공개 버킷(index.html preconnect와 같다). */
const ASSET_STORAGE_ORIGIN = 'https://kbghxgejrkebdhjwizbr.supabase.co';
const APP_HOST_SUFFIX = '.qstory.ai.kr';

/** 주소로 읽히는 속성 - 허용하지 않는 주소면 속성을 뺀다. */
const URL_ATTRIBUTES = new Set([
  'src',
  'href',
  'xlink:href',
  'poster',
  'data',
  'action',
  'formaction',
  'background',
  'ping',
  'longdesc',
  'cite',
  'manifest',
  'lowsrc',
  'dynsrc',
  'codebase',
  'archive',
  'profile',
  'icon',
  'itemtype',
]);
const SRCSET_ATTRIBUTES = new Set(['srcset', 'imagesrcset']);
/** 내용을 안전하게 고칠 수 없어 통째로 빼는 속성(iframe srcdoc은 HTML 전체다). */
const DROPPED_ATTRIBUTES = new Set(['srcdoc']);

/** CSS에서 막은 url() 자리에 넣는 값 - 요청을 만들지 않고, 페이지 CSP(img-src·font-src의 data:)에도 걸리지 않는다. */
export const BLOCKED_CSS_URL = 'data:,';

export type ReplayUrlPolicy = { allowedOrigins: readonly string[] };

export function defaultReplayUrlPolicy(currentOrigin?: string): ReplayUrlPolicy {
  const origins = [ASSET_STORAGE_ORIGIN];
  if (currentOrigin) origins.push(currentOrigin);
  return { allowedOrigins: origins };
}

function originAllowed(url: URL, policy: ReplayUrlPolicy) {
  if (policy.allowedOrigins.includes(url.origin)) return true;
  // 우리 앱 배포 주소들(demo·play 등) - 녹화 안의 같은 앱 자산(/assets/...)은 이 출처로 절대 주소가 된다.
  return url.protocol === 'https:' && url.hostname.endsWith(APP_HOST_SUFFIX);
}

function parsedOriginAllowed(url: string, policy: ReplayUrlPolicy) {
  try {
    return originAllowed(new URL(url), policy);
  } catch {
    return false;
  }
}

/** 재생에서 이 주소를 그대로 둬도 되는지 - 허용 출처·상대 주소·data:/blob:·#조각만. */
export function isAllowedReplayUrl(raw: string, policy: ReplayUrlPolicy): boolean {
  // 판정용으로만 공백·제어 문자를 모두 뺀다 - 브라우저가 무시하는 앞뒤 공백과 중간의 탭·줄바꿈
  // (java\tscript:, \nhttps://...) 우회를 막는다.
  // eslint-disable-next-line no-control-regex
  const compact = raw.replace(/[\u0000- \u007f]/g, '');
  if (compact === '' || compact.startsWith('#')) return true;
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(compact)?.[1]?.toLowerCase();
  if (!scheme) {
    // 프로토콜 상대 주소(//host/...)는 바깥으로 나갈 수 있다. \\host도 브라우저는 //로 읽는다.
    if (/^[\\/]{2}/.test(compact)) return parsedOriginAllowed(`https:${compact.replace(/\\/g, '/')}`, policy);
    // 상대 주소 - 재생 iframe 기준(이 페이지 출처)으로 풀린다.
    return true;
  }
  if (scheme === 'data' || scheme === 'blob') return true;
  if (scheme === 'http' || scheme === 'https') return parsedOriginAllowed(compact, policy);
  return false;
}

function sanitizeSrcset(value: string, policy: ReplayUrlPolicy) {
  return value
    .split(',')
    .map((candidate) => candidate.trim())
    .filter((candidate) => candidate && isAllowedReplayUrl(candidate.split(/\s+/)[0], policy))
    .join(', ');
}

// 따옴표 문자열 "..."/'...'(이스케이프 포함) 또는 따옴표 없는 url(...) 본문.
const DQ = String.raw`"((?:[^"\\]|\\.)*)"`;
const SQ = String.raw`'((?:[^'\\]|\\.)*)'`;
const CSS_URL = new RegExp(String.raw`url\(\s*(?:${DQ}|${SQ}|([^)'"]*?))\s*\)`, 'gi');
const CSS_IMPORT = new RegExp(String.raw`@import(\s*(?:url\(\s*(?:${DQ}|${SQ}|([^)'"]*?))\s*\)|${DQ}|${SQ}))`, 'gi');
const CSS_IMAGE_SET_STRING = new RegExp(String.raw`(image-set\([^)]*?)(?:${DQ}|${SQ})`, 'gi');

/** CSS 이스케이프(\68ttp, \:)를 풀어 판정한다 - 판정만 하고 원문은 바꾸지 않는다. */
function unescapeCss(value: string) {
  return value.replace(/\\([0-9a-fA-F]{1,6})\s?|\\(.)/g, (_, hex: string | undefined, char: string | undefined) =>
    hex ? String.fromCodePoint(Number.parseInt(hex, 16) || 0xfffd) : (char ?? ''),
  );
}

const firstDefined = (values: (string | undefined)[]) => values.find((value) => value !== undefined) ?? '';

/**
 * CSS 텍스트 안의 @import·url(...)·image-set("...") 주소를 고친다. 바깥 @import는 모르는 at-rule(@blocked-import)로
 * 바꿔 브라우저가 무시하게 하고(규칙 경계는 그대로), 나머지는 빈 data: 주소로 바꾼다.
 */
export function sanitizeReplayCss(css: string, policy: ReplayUrlPolicy): string {
  if (!/url\(|@import|image-set/i.test(css)) return css;
  const blocked = (url: string) => !isAllowedReplayUrl(unescapeCss(url), policy);
  let result = css.replace(CSS_IMPORT, (match, rest: string, ...urls: (string | undefined)[]) =>
    blocked(firstDefined(urls.slice(0, 5))) ? `@blocked-import${rest}` : match,
  );
  result = result.replace(CSS_URL, (match, ...urls: (string | undefined)[]) =>
    blocked(firstDefined(urls.slice(0, 3))) ? `url("${BLOCKED_CSS_URL}")` : match,
  );
  let previous: string;
  do {
    previous = result;
    result = result.replace(CSS_IMAGE_SET_STRING, (match, head: string, ...urls: (string | undefined)[]) =>
      blocked(firstDefined(urls.slice(0, 2))) ? `${head}"${BLOCKED_CSS_URL}"` : match,
    );
  } while (result !== previous);
  return result;
}

function sanitizeAttributes(attributes: Record<string, unknown>, policy: ReplayUrlPolicy) {
  for (const key of Object.keys(attributes)) {
    const name = key.toLowerCase();
    const value = attributes[key];
    if (DROPPED_ATTRIBUTES.has(name)) {
      delete attributes[key];
      continue;
    }
    if (typeof value !== 'string') {
      // 변경 이벤트의 style 속성은 {속성: 값} 객체로 올 수 있다 - 문자열 규칙으로 돈다.
      attributes[key] = sanitizeValue(value, policy);
      continue;
    }
    if (URL_ATTRIBUTES.has(name)) {
      // 막힌 주소 속성은 뺀다 - 가짜 주소를 넣으면 그것도 요청이나 CSP 경고가 된다.
      if (!isAllowedReplayUrl(value, policy)) delete attributes[key];
    } else if (SRCSET_ATTRIBUTES.has(name)) {
      attributes[key] = sanitizeSrcset(value, policy);
    } else if (name === 'content' && /url\s*=/i.test(value)) {
      // <meta http-equiv="refresh" content="0;url=..."> - 재생 iframe을 바깥 주소로 옮긴다.
      attributes[key] = '';
    } else if (name === 'http-equiv' && /refresh/i.test(value)) {
      attributes[key] = '';
    } else {
      attributes[key] = sanitizeReplayCss(value, policy);
    }
  }
}

function sanitizeValue(value: unknown, policy: ReplayUrlPolicy): unknown {
  if (typeof value === 'string') return sanitizeReplayCss(value, policy);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) value[index] = sanitizeValue(value[index], policy);
    return value;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      const child = record[key];
      if (key === 'attributes' && child && typeof child === 'object' && !Array.isArray(child)) {
        sanitizeAttributes(child as Record<string, unknown>, policy);
      } else {
        record[key] = sanitizeValue(child, policy);
      }
    }
    return record;
  }
  return value;
}

/**
 * 이벤트 배열의 바깥 주소를 제자리에서 지운다(JSON.parse로 막 만든 객체라 복사하지 않는다). 같은 배열을 돌려준다.
 */
export function sanitizeReplayEvents<T>(events: T[], policy: ReplayUrlPolicy): T[] {
  for (const event of events) sanitizeValue(event, policy);
  return events;
}
