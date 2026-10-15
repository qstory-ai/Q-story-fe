import { primitives as p } from './design-tokens';
import { alpha, radius as r, rawExtensions, semanticColors, space } from './tokens';

const L = semanticColors.light;
const D = semanticColors.dark;
/** 리더 어두운 바탕·전역 그림자 색(Figma 변수 아님 - rawExtensions). */
const INK = rawExtensions.ink;

/**
 * Q-Story 앱 전역 의미(semantic) 토큰. 값은 디자인 시스템 primitive(design-tokens.ts, Figma 변수)를 참조한다 -
 * 대응표는 qstory/docs/planning/디자인-시스템.md 6장(2026-10-15 CTO 결정). 콘솔 세계(대시보드·인증·마이페이지)는
 * Neutral 50 바탕 + Purple 500 primary, 리더(one-story)·랜딩·사이드바는 어두운 바탕 + Purple 400 강조 + ivory 카드.
 * 골드는 쓰지 않는다(보라 하나로 통일) - 예전 gold 토큰 이름은 그대로 두고 값만 Purple로 바꿨다.
 *
 * 2026-10 토큰 3계층 재구성 이후: 이 객체의 이름들은 `tokens.ts` Semantic(L = Light, D = Dark)의 **별칭**이다.
 * 새 코드는 `semanticColors`·`space`·`radius`·`shadow()`·`textStyles`를 직접 쓰고, 여기 이름은 화면을 옮기면서 줄인다.
 * 아직 Semantic에 대응이 없는 값(리더 전용 톤, 반투명 막 등)은 primitive를 그대로 둔다.
 */
export const storybookTheme = {
  color: {
    // 메인 컨텐츠 배경은 라이트. 다크 계열 토큰(onDark 등)은 다크로 남는 사이드바/리더용.
    background: L.bg.secondary,
    // ── 라이트 컨텐츠 팔레트 ────────────────────────────────────────────
    /** 메인 컨텐츠 영역의 카드/시트. 순백. */
    contentSurface: L.bg.primary,
    /** contentSurface의 경계 - 흰 배경 위에 살짝 뜨는 hairline. */
    contentSurfaceBorder: L.border.secondary,
    /** 컨텐츠 위 서브 패널 - 흰 카드 안의 sub-section이나 리스트 아이템 배경. */
    /** Neutral 50 - 위에 얹는 흐린 글자(onContentMuted, Neutral 600)가 4.75:1이 되게 한다(Neutral 100이면 4.45). */
    contentPanel: L.bg.secondary,
    contentPanelBorder: L.border.secondary,
    /** 컨텐츠 위 텍스트. onCard*와 별개로 페이지 배경 직접 위의 텍스트에 씀. */
    onContent: L.text.primary,
    onContentMuted: L.text.tertiary,
    // ── 사이드바 전용(다크 유지) ────────────────────────────────────────────
    /** AppNavShell wide 사이드바. */
    sidebarBackground: D.bg.secondary,
    sidebarBorder: 'rgba(255, 255, 255, 0.08)',
    sidebarActive: 'rgba(255, 255, 255, 0.10)',
    // ── 서피스 토큰 ──────────────────────────────────────────────────────
    /** 콘솔 세계(대시보드·인증·마이페이지)의 카드 - contentSurface와 같은 순백 + hairline. */
    surfaceCard: L.bg.primary,
    surfaceCardBorder: L.border.secondary,
    /** 리더(one-story)·랜딩 전용 - 다크 배경 위에 앉는 따뜻한 크림 카드. 콘솔 페이지에서는 쓰지 않는다. */
    storybookCard: alpha(p.base.ivory, 0.96),
    /**
     * 강조 채움·마커(캘린더 오늘, 사이드바 활성 아이콘, 진행 막대 등). 이름은 예전 골드에서 왔고 값은 Purple 400 -
     * 흰 바탕 3.4:1이라 글자색으로는 goldText를 쓴다.
     */
    gold: L.bg.indicator,
    /**
     * 강조 "채움 위 글자" 짝 - 예전 골드 채움 버튼·탭·번호 원 자리. 채움 Purple 500 + 흰 글자 5.46:1.
     * 글자·아이콘이 없는 채움(진행 막대·점·라디오 점)은 gold(Purple 400)를 쓴다.
     */
    accentFill: L.bg.interactive.primary.default,
    accentFillHover: L.bg.interactive.primary.hover,
    onAccentFill: L.text.interactive.inverse,
    /** accentFill 위에 얹는 점·마커(캘린더 선택일의 일정 점 등). */
    markerOnAccentFill: p.base.white,
    /**
     * 어두운 바탕(리더 캡션·사이드바·장면 위 반투명 패널) 위 강조 글자 - Purple 200. 리더 어두운 패널 #2D1935 위 10.1:1,
     * Purple 900 위 8.57:1.
     */
    accentOnDark: D.text.interactive.primary.default,
    /** 리더 상단 강조 버튼의 어두운 반투명 바탕. */
    readerControlBackground: alpha(p.purple[900], 0.86),
    /** 강조색을 옅게 깐 바탕(배지·도크 버튼·알림 아이콘 바탕) - 예전 골드 16% 자리. */
    accentSoft: alpha(p.purple[400], 0.16),
    /** accentSoft보다 진한 강조 바탕(눌러야 할 버튼 강조). */
    accentSoftStrong: alpha(p.purple[400], 0.28),
    /** 강조 바탕의 테두리. */
    accentSoftBorder: alpha(p.purple[400], 0.5),
    /** 리더·리포트 카드의 옅은 보라 테두리. */
    accentBorderLight: p.purple[200],
    /** 앱 전역 CTA/링크/키 컬러의 밑바탕 - 흰 글자 5.46:1. */
    primary: L.bg.interactive.primary.default,
    onDark: D.text.primary,
    onDarkMuted: 'rgba(255, 255, 255, 0.72)',
    // 카드 위 텍스트 3단 - onContent*와 같은 hue. muted는 흰 카드 기준 4.8:1(AA).
    onCardTitle: L.text.primary,
    onCardBody: L.text.secondary,
    onCardMuted: L.text.tertiary,
    /** 라이트 카드 위 은은한 배지 배경. */
    pillBackground: L.bg.tertiary,
    pillBorder: L.border.secondary,
    /** 스토리북 테마 페이지(landing/detail/story-card)의 모든 카드가 공유하는 shadowColor. */
    shadow: INK,
    /** 삽화 위 글자·배지를 받치는 어두운 막(그림자 색 기반). */
    imageScrim: alpha(INK, 0.6),
    imageScrimStrong: alpha(INK, 0.72),
    /** 어두운 바탕 위 반투명 흰 막(배지 바탕·hairline). */
    onDarkOverlay: 'rgba(255, 255, 255, 0.16)',
    onDarkHairline: 'rgba(255, 255, 255, 0.1)',
    /** 리더 대화 패널 바탕(삽화 위 90%). */
    readerPanelBackground: alpha(INK, 0.9),
    /** 삽화 위에 아주 옅게 까는 막. */
    imageShade: alpha(INK, 0.12),
    /** 삽화 위 글자 그림자. */
    textShadow: alpha(INK, 0.6),
    /** 녹음·재생 중 점·음량 막대 채움 - Pink 500. */
    recording: D.bg.recording,
    /** 삽화가 오기 전 자리 - Neutral 100. */
    imagePlaceholder: L.bg.tertiary,
    /** 이야기에 아직 커버 아트가 없을 때의 커버 이미지 자리표시자 배경. */
    coverFallback: D.bg.secondary,
    /**
     * 밝은 바탕 위 강조 글자(선택된 아이 이름, 강조 라벨, 눌리는 글자) - Purple 800, 흰 바탕 6.94:1. 이름은 예전 골드
     * 글자 토큰에서 왔다. 채움·마커는 gold, 어두운 바탕 위 강조 글자는 accentOnDark.
     */
    goldText: L.text.interactive.selected,
    /** 모달 뒤 배경 딤 처리. */
    scrim: 'rgba(15, 8, 25, 0.72)',
    /** 모달 카드처럼 배경이 완전히 비쳐 보이면 안 되는 서피스용. 콘솔 세계에서는 순백. */
    surfaceCardOpaque: L.bg.primary,
    /** 입력창/체크박스 박스처럼 항상 순수한 흰색이어야 하는 서피스. */
    surfaceWhite: L.bg.primary,
    /**
     * 인증·온보딩·대시보드의 "라이트 셸" 계열 - Neutral 50 바탕, 제목 900 / 본문 700 / 흐린 글자 600 / 테두리 300.
     */
    shellBackground: L.bg.secondary,
    onLightHeading: L.text.primary,
    onLightBody: L.text.secondary,
    onLightMuted: L.text.tertiary,
    lightCardBorder: L.border.secondary,
    linkOnDark: D.text.link,
    /** 라이트 배경 위 링크 - Purple 800(흰 바탕 6.94:1). 본문과 구분되게 밑줄과 함께 쓴다. */
    linkOnLight: L.text.link,
    /** 에러/위험 상태 - Pink 700, 흰 바탕 5.47:1. */
    error: L.text.error,
    /** 어두운 바탕(리더 대화 패널·캡션) 위 오류 글자 - Pink 500, 리더 어두운 패널 위 6.7:1. */
    errorOnDark: D.text.error,
    /** 로고 프레임(brand-lockup, 리더 top-bar) 배경. */
    brandFrameBackground: alpha(p.base.ivory, 0.96),
    /** 어두운 배경 위 반투명 패널의 테두리. */
    panelOnDarkBorder: 'rgba(255, 252, 245, 0.16)',
    /** 비활성 버튼도 라벨은 읽혀야 한다(ActionButton) - Neutral 600 on Neutral 50 = 4.75:1. 테두리로 바탕과 구분한다. */
    disabledBackground: L.bg.disabled,
    disabledBorder: L.border.disabled,
    disabledText: L.text.disabled,
    /**
     * 리더(one-story) 전용 톤 - 리더 여러 화면(제목/카드/그림자/본문 3단)에서 반복되는 값.
     * 리더의 크림 배경 위 대비를 위해 primary와 별도로 둔다.
     */
    readerHeading: '#28153F',     // heroTitle/panelTitle/recordingTitle/loadingTitle
    readerBodyStrong: '#2D1948',  // 리포트의 강조 본문(질문 텍스트/번호)
    readerBody: '#35204D',        // 리포트 pill/coach summary 본문
    readerBodyMuted: '#746987',   // 리포트 hero body/panel description 등 보조 본문
    readerShadow: '#2E1948',      // 리포트 카드/topBar 전용 그림자 (전역 shadow #12091F보다 밝음)
    readerCard: '#FFF7E9',        // 리포트 카드 배경 (surfaceCardOpaque #FFFCF5보다 따뜻한 크림)
    /**
     * 캘린더 주말 글자 - 국내 캘린더 관행. 흰 카드 위 일요일 Pink 700 5.47:1, 토요일 Skyblue 700 4.53:1(흰 바탕 전용 -
     * Neutral 50 위는 4.3이라 캘린더는 흰 카드에 둔다). *Soft는 요일 칩 테두리.
     */
    calendarSunday: L.text.error,
    calendarSaturday: L.text.info,
    calendarSundaySoft: alpha(p.pink[500], 0.6),
    calendarSaturdaySoft: alpha(p.skyblue[500], 0.6),
  },
  /**
   * 시맨틱 컬러 램프 - 카테고리별 default/secondary/hover/on-X 구조. danger는 error/status.warning과
   * 같은 빨강 계열 값을 "위험" 의미로 재사용한다(status.warning은 이름과 달리 빨강 계열이다).
   */
  semantic: {
    brand: {
      default: L.bg.interactive.primary.default,
      /** hover·pressed - 흰 글자 6.94:1. */
      hover: L.bg.interactive.primary.hover,
      secondary: L.bg.brandSubtle,
      onBrand: L.text.interactive.inverse,
    },
    /** 강조 채움 CTA(ActionButton variant="gold") - color.accentFill 짝과 같은 값. */
    accent: {
      default: L.bg.interactive.primary.default,
      hover: L.bg.interactive.primary.hover,
      onAccent: L.text.interactive.inverse,
    },
    /** 성공 - Figma Green(50 바탕 · 200 테두리 · 800 글자, 2026-10-15 2차 변수). */
    positive: {
      /** 흰 글자를 얹는 채움(복사 완료 버튼 등) - successBold(흰 글자 5.53:1). */
      default: L.bg.successBold,
      background: L.bg.successSubtle,
      border: L.border.successSubtle,
      text: L.text.success,
    },
    /** 오류·위험 - Figma Pink(50 바탕 · 200 테두리 · 700 글자). 글자 Pink 700은 Pink 50 위 5.02:1. */
    danger: {
      default: L.bg.error,
      background: L.bg.errorSubtle,
      border: L.border.errorSubtle,
      text: L.text.error,
    },
  },
  /** 경고/정보 배너(StatusBanner 등) 한 벌. */
  status: {
    /**
     * Skyblue 계열. Skyblue 700 글자는 흰 바탕에서만 4.53:1이고 하늘색 바탕 위에서는 4.2:1대라, 이 바탕 위 글자는
     * Neutral 700/900을 쓴다(text는 흰 바탕 위 정보 글자용).
     */
    info: {
      background: L.bg.infoSubtle,
      border: L.border.infoSubtle,
      rule: p.skyblue[500],
      text: L.text.info,
    },
    warning: {
      background: L.bg.errorSubtle,
      border: L.border.errorSubtle,
      /** 오류 분홍을 그대로 쓴다(41곳). Semantic warning(Yellow)으로 바꿀지는 화면별로 판단 - 3단계 제안. */
      text: L.text.error,
    },
  },
  /** 라운드 토큰. `pill`은 "완전히 둥글게", `control`은 체크박스/라디오 박스 전용. */
  radius: {
    card: r[16],
    pill: 999,
    logoFrame: r[12],
    /** 스케일(16·32) 밖 - 2단계 컴포넌트 정리 때 맞춘다. */
    modalCard: 20,
    /** 스케일 밖 - 2단계에서 정리. */
    button: 14,
    input: r[12],
    control: r[4],
  },
  /** 화면에 겹쳐지는 것들의 쌓임 순서 - 실제로 쓰는 만큼만 둔다. */
  zIndex: {
    sticky: 5,
    overlay: 20,
  },
  /**
   * Solid 2.0의 모션 밴드(micro 0-300ms / baseline 300ms / popup·dimmed·fade 300-800ms /
   * complex 800-1500ms)에서 대표값을 하나씩 골랐다.
   */
  motion: {
    durationMs: {
      micro: 150,
      base: 300,
      moderate: 500,
      complex: 1200,
    },
  },
  /** fontSize 스케일 - 화면마다 임의의 숫자를 고르지 말고 이 스케일을 공유한다. */
  type: {
    xxs: 11, // 뱃지/키커 같은 초소형 텍스트
    xs: 12, // eyebrow/caption/pill 레이블
    sm: 14, // 보조 본문 텍스트, 작은 버튼
    md: 16, // 주요 본문 텍스트, 카드 제목
    lg: 24, // 섹션 헤더
    xl: 26, // 페이지 헤드라인
    xxl: 32, // 히어로 순간에만 사용
    /** RN fontWeight는 문자열이어야 해서 숫자가 아니라 문자열 맵으로 둔다. */
    weight: {
      light: '300',
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      black: '900',
    },
  },
  /** 헤딩류(md 이상)는 타이트한 줄간격+음수 자간, 본문류(xs/sm)는 여유있는 줄간격. */
  lineHeight: {
    tight: 1.2, // 헤딩(md 이상)
    normal: 1.4, // 본문(xs/sm)
  },
  tracking: {
    heading: -0.02, // 헤딩류에 쓰는 음수 자간 (fontSize * -0.02)
  },
  /**
   * 카드 그림자 단계. 진한 드롭 섀도 대신 얇은 테두리와 낮은 들뜸(lift)에 기대도록 가볍게 잡았다.
   */
  elevation: {
    low: {
      shadowColor: INK,
      shadowOpacity: 0.06,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 6 },
    },
    high: {
      shadowColor: INK,
      shadowOpacity: 0.1,
      shadowRadius: 30,
      shadowOffset: { width: 0, height: 14 },
    },
    /** 모달 카드 - low/high보다 진하다. */
    modal: {
      shadowColor: INK,
      shadowOpacity: 0.22,
      shadowRadius: 40,
      shadowOffset: { width: 0, height: 18 },
    },
  },
  /** 4px 배수 스페이싱 스케일. */
  spacing: {
    xs: space[4],
    sm: space[8],
    ms: space[12],
    md: space[16],
    ml: space[20],
    lg: space[24],
    xl: space[32],
    xxl: space[40],
  },
  /**
   * 페이지 콘텐츠 폭. `contentMaxWidth`는 로그인/가입처럼 순수 단일 컬럼 입력 폼 전용이고,
   * `wideMaxWidth`는 다중 아이템 그리드(홈 서재)용이다. 그 외 대시보드형 페이지는
   * dashboardCard*를 기본으로 고려할 것.
   */
  layout: {
    contentMaxWidth: 420,
    wideMaxWidth: 1040,
    /** 대시보드 히어로 카드 폭. */
    dashboardCardMaxWidth: 640,
    dashboardCardWideMaxWidth: 760,
    /** 학생/일정 리스트처럼 폼보다 넓고 대시보드보다 좁은 중간 밀도 페이지. */
    narrowMaxWidth: 560,
    /** 튜터 홈처럼 밀도가 높지만 라이브러리 그리드만큼 넓을 필요는 없는 페이지. */
    tabletMaxWidth: 720,
  },
} as const;
