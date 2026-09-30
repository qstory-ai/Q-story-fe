/**
 * Q-Story 앱 전역 디자인 토큰. 콘솔 세계(대시보드·인증·마이페이지)는 라이트 배경 + 네이비
 * primary, 리더(one-story)·랜딩·우측 사이드바는 다크 배경 + 골드 강조 + 크림 카드를 쓴다.
 */
export const storybookTheme = {
  color: {
    // 메인 컨텐츠 배경은 라이트. 다크 계열 토큰(onDark 등)은 다크로 남는 사이드바/리더용.
    background: '#F7F8FA',
    // ── 라이트 컨텐츠 팔레트 ────────────────────────────────────────────
    /** 메인 컨텐츠 영역의 카드/시트. 순백. */
    contentSurface: '#FFFFFF',
    /** contentSurface의 경계 - 흰 배경 위에 살짝 뜨는 hairline. */
    contentSurfaceBorder: 'rgba(15, 23, 42, 0.08)',
    /** 컨텐츠 위 서브 패널 - 흰 카드 안의 sub-section이나 리스트 아이템 배경. */
    contentPanel: 'rgba(15, 23, 42, 0.03)',
    contentPanelBorder: 'rgba(15, 23, 42, 0.08)',
    /** 컨텐츠 위 텍스트 - 네이비 계열. onCard*와 별개로 페이지 배경 직접 위의 텍스트에 씀. */
    onContent: '#1E293B',
    onContentMuted: 'rgba(30, 41, 59, 0.68)',
    onContentSubtle: 'rgba(30, 41, 59, 0.5)',
    // ── 사이드바 전용(다크 유지) ────────────────────────────────────────────
    /** AppNavShell wide 사이드바 - 가비아 네이비 그대로 차용. */
    sidebarBackground: '#242D38',
    sidebarBorder: 'rgba(255, 255, 255, 0.08)',
    sidebarActive: 'rgba(255, 255, 255, 0.10)',
    // ── 서피스 토큰 ──────────────────────────────────────────────────────
    /** 콘솔 세계(대시보드·인증·마이페이지)의 카드 - contentSurface와 같은 순백 + hairline. */
    surfaceCard: '#FFFFFF',
    surfaceCardBorder: 'rgba(15, 23, 42, 0.08)',
    /** 리더(one-story)·랜딩 전용 - 다크 배경 위에 앉는 따뜻한 크림 카드. 콘솔 페이지에서는 쓰지 않는다. */
    storybookCard: 'rgba(255, 252, 245, 0.96)',
    gold: '#F6C64D',
    /** 앱 전역 CTA/링크/키 컬러의 밑바탕(네이비). */
    primary: '#1E293B',
    onDark: '#FFFFFF',
    onDarkMuted: 'rgba(255, 255, 255, 0.72)',
    // 카드 위 텍스트 3단 - onContent*와 같은 hue. muted는 흰 카드 기준 4.8:1(AA).
    onCardTitle: '#1E293B',
    onCardBody: '#475569',
    onCardMuted: '#64748B',
    /** 라이트 카드 위 은은한 배지 배경. */
    pillBackground: 'rgba(30, 41, 59, 0.06)',
    pillBorder: 'rgba(30, 41, 59, 0.14)',
    /** 스토리북 테마 페이지(landing/detail/story-card)의 모든 카드가 공유하는 shadowColor. */
    shadow: '#12091F',
    /** 이야기에 아직 커버 아트가 없을 때의 커버 이미지 자리표시자 배경 - 네이비 딥. */
    coverFallback: '#243447',
    /**
     * 라이트 배경 위에 "글자"로 놓는 골드. 브랜드 골드(#F6C64D)는 흰 배경에서 1.6:1이라 글자로 못
     * 쓴다 - 선택된 아이 이름, 워드마크의 Q, 강조 라벨처럼 골드 hue를 유지해야 하는 텍스트는 이
     * 앰버(흰 배경 5.9:1)를 쓴다. 채움·마커(캘린더 오늘, 사이드바 활성 아이콘)는 계속 gold.
     */
    goldText: '#8A6300',
    /** 모달 뒤 배경 딤 처리. */
    scrim: 'rgba(15, 8, 25, 0.72)',
    /** 모달 카드처럼 배경이 완전히 비쳐 보이면 안 되는 서피스용. 콘솔 세계에서는 순백. */
    surfaceCardOpaque: '#FFFFFF',
    /** 입력창/체크박스 박스처럼 항상 순수한 흰색이어야 하는 서피스. */
    surfaceWhite: '#FFFFFF',
    /**
     * 인증·온보딩·대시보드의 "라이트 셸" 계열. onLightHeading은 값이 primary와 같지만
     * ("브랜드 버튼 채우기"가 아니라 "밝은 카드 위 제목") 의미가 달라 별도 토큰으로 둔다.
     */
    shellBackground: '#F7F8FA',
    onLightHeading: '#1E293B',
    onLightBody: '#475569',
    onLightMuted: '#64748B',
    lightCardBorder: 'rgba(15, 23, 42, 0.14)',
    linkOnDark: '#DCD1FF',
    /** 라이트 배경 위 링크 - 본문 네이비와 구분되는 한 단계 밝은 블루(흰 배경 7:1). 밑줄과 함께 쓴다. */
    linkOnLight: '#2451B2',
    /** 에러/위험 상태 - 흰 배경 기준 WCAG AA 4.5:1. */
    error: '#C24A2E',
    /** 로고 프레임(brand-lockup, 리더 top-bar) 배경. */
    brandFrameBackground: 'rgba(255, 249, 237, 0.96)',
    /** 어두운 배경 위 반투명 패널의 테두리. */
    panelOnDarkBorder: 'rgba(255, 252, 245, 0.16)',
    /** 폼 필드의 비활성 상태 - primary 네이비에서 파생시켜 pillBackground/pillBorder와 톤을 맞춘다. */
    disabledBackground: 'rgba(30, 41, 59, 0.06)',
    disabledBorder: 'rgba(30, 41, 59, 0.18)',
    disabledText: '#8A94A6',
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
    /** 캘린더 주말 컬러 - 국내 캘린더 관행. 어두운 배경/크림 카드 양쪽에서 4.5:1 이상인 파스텔 톤. */
    calendarSunday: '#FF9AA2',
    calendarSaturday: '#9EC8FF',
  },
  /**
   * 시맨틱 컬러 램프 - 카테고리별 default/secondary/hover/on-X 구조. danger는 error/status.warning과
   * 같은 빨강 계열 값을 "위험" 의미로 재사용한다(status.warning은 이름과 달리 빨강 계열이다).
   */
  semantic: {
    brand: {
      default: '#1E293B',
      // primary보다 한 톤 어둡게.
      hover: '#0F172A',
      secondary: 'rgba(30, 41, 59, 0.08)',
      onBrand: '#FFFFFF',
    },
    /** 골드 CTA 전용 계열 - brand(네이비)와 별개로 둔다. */
    accent: {
      default: '#F6C64D',
      hover: '#E8B93D',
      onAccent: '#1E293B',
    },
    positive: {
      default: '#2F9E62',
      background: '#E6F6EC',
      border: '#BFE6CC',
      text: '#1F7A48',
    },
    danger: {
      default: '#C24A2E',
      background: '#FBEAE3',
      border: '#F0C3AE',
      text: '#AC4A2A',
    },
  },
  /** 경고/정보 배너(StatusBanner 등) 한 벌. */
  status: {
    info: {
      background: '#E8EEF7',
      border: '#C7D3E6',
    },
    warning: {
      background: '#FBEAE3',
      border: '#F0C3AE',
      /** 배경 대비 WCAG AA 4.5:1. */
      text: '#AC4A2A',
    },
  },
  /** 라운드 토큰. `pill`은 "완전히 둥글게", `control`은 체크박스/라디오 박스 전용. */
  radius: {
    card: 16,
    pill: 999,
    logoFrame: 12,
    modalCard: 20,
    button: 14,
    input: 12,
    control: 4,
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
      shadowColor: '#12091F',
      shadowOpacity: 0.06,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 6 },
    },
    high: {
      shadowColor: '#12091F',
      shadowOpacity: 0.1,
      shadowRadius: 30,
      shadowOffset: { width: 0, height: 14 },
    },
    /** 모달 카드 - low/high보다 진하다. */
    modal: {
      shadowColor: '#12091F',
      shadowOpacity: 0.22,
      shadowRadius: 40,
      shadowOffset: { width: 0, height: 18 },
    },
  },
  /** 4px 배수 스페이싱 스케일. */
  spacing: {
    xs: 4,
    sm: 8,
    ms: 12,
    md: 16,
    ml: 20,
    lg: 24,
    xl: 32,
    xxl: 40,
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
