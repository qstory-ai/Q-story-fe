import { trackBetaEvent, type BetaMetadataInput } from './beta-events';
import { utmFromHref } from './app-entry';

/** 공개 소개 화면 - 대문(랜딩)과 시작 안내(튜토리얼). */
export type LandingPageName = 'landing' | 'tutorial';

/** 소개 화면의 주요 버튼 - 체험·가입·로그인·문의로 넘어가는 곳. */
export type LandingCtaLocation =
  | 'header_demo'
  | 'hero_start'
  | 'hero_explore'
  | 'beta_demo'
  | 'preview_demo'
  | 'final_demo'
  | 'tutorial_signup_parent'
  | 'tutorial_signup_teacher'
  | 'tutorial_skip'
  | 'tutorial_login'
  | 'footer_contact';

/** landing_view 메타데이터 - 서버는 page·entry와 공통 utm 키만 받는다. 앱 안의 소개 화면이라 entry는 app. */
export function landingViewMetadata(page: LandingPageName, href: string | null | undefined): BetaMetadataInput {
  return { page, entry: 'app', ...utmFromHref(href) };
}

/** 페이지 로드당 한 번 - 앱 안에서 다시 돌아오거나 개발 모드에서 effect가 두 번 돌아도 다시 보내지 않는다. */
const viewedPages = new Set<LandingPageName>();

export function trackLandingView(page: LandingPageName) {
  if (viewedPages.has(page)) return;
  viewedPages.add(page);
  void trackBetaEvent('landing_view', landingViewMetadata(page, typeof window === 'undefined' ? null : window.location.href));
}

export function trackLandingCta(ctaLocation: LandingCtaLocation) {
  void trackBetaEvent('landing_cta_click', { cta_location: ctaLocation });
}
