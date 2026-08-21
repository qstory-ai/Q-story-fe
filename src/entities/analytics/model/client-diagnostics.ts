export type BrowserFamily =
  | 'chrome'
  | 'edge'
  | 'firefox'
  | 'safari'
  | 'samsung-internet'
  | 'unknown';

export type PlatformClass =
  | 'android'
  | 'ipad'
  | 'iphone'
  | 'mac'
  | 'windows'
  | 'other';

export function browserFamilyFromUserAgent(userAgent: string): BrowserFamily {
  if (/SamsungBrowser\//i.test(userAgent)) return 'samsung-internet';
  if (/(?:Edg|EdgiOS|EdgA)\//i.test(userAgent)) return 'edge';
  if (/(?:CriOS|Chrome)\//i.test(userAgent)) return 'chrome';
  if (/(?:FxiOS|Firefox)\//i.test(userAgent)) return 'firefox';
  if (/Safari\//i.test(userAgent)) return 'safari';
  return 'unknown';
}

export function platformClassFromUserAgent(
  userAgent: string,
  maxTouchPoints = 0,
): PlatformClass {
  if (/iPad/i.test(userAgent)) return 'ipad';
  if (/iPhone|iPod/i.test(userAgent)) return 'iphone';
  if (/Android/i.test(userAgent)) return 'android';
  if (/Macintosh|Mac OS X/i.test(userAgent)) {
    return maxTouchPoints > 1 ? 'ipad' : 'mac';
  }
  if (/Windows/i.test(userAgent)) return 'windows';
  return 'other';
}

export function currentClientDiagnostics() {
  if (typeof navigator === 'undefined') {
    return {
      browser_family: 'unknown' as const,
      platform_class: 'other' as const,
    };
  }
  const userAgent = navigator.userAgent ?? '';
  return {
    browser_family: browserFamilyFromUserAgent(userAgent),
    platform_class: platformClassFromUserAgent(
      userAgent,
      navigator.maxTouchPoints ?? 0,
    ),
  };
}
