/**
 * 스토리북 팔레트 - 인증 퍼널이 쓰는 더 밝은 라벤더색 "shell" 팔레트가 아니라, 리더 자체의
 * 스타일(pages/one-story/ui/styles.ts 참고)에서 가져온 실제 Q-Story 브랜드 정체성
 * (어두운 배경, 골드 강조색, 크림색 카드)이다. 지금은 새 페이지에만 적용하고 - 기존
 * ActionButton/TextField나 기존 인증 페이지들에는 소급 적용하지 않는다.
 */
export const storybookTheme = {
  color: {
    background: '#161025',
    backgroundOverlay: 'rgba(18, 10, 30, 0.12)',
    surfaceCard: 'rgba(255, 252, 245, 0.96)',
    surfaceCardBorder: 'rgba(255, 255, 255, 0.72)',
    gold: '#F6C64D',
    primary: '#43225F',
    onDark: '#FFFFFF',
    onDarkMuted: 'rgba(255, 255, 255, 0.72)',
    onCardTitle: '#2B1748',
    onCardBody: '#5E5367',
    /** WCAG AA 4.5:1을 만족하도록 surfaceCardOpaque(#FFFCF5) 대비로 조정한 값(원래 #85778E는 4.08:1로 미달). */
    onCardMuted: '#7A6C82',
    pillBackground: 'rgba(67, 34, 95, 0.08)',
    pillBorder: 'rgba(67, 34, 95, 0.16)',
    /** 스토리북 테마 페이지(landing/detail/story-card)의 모든 카드가 공유하는 shadowColor. */
    shadow: '#12091F',
    /** 이야기에 아직 커버 아트가 없을 때의 커버 이미지 자리표시자 배경. */
    coverFallback: '#2A1D3D',
    /** 모달 뒤 배경 딤 처리 - one-story의 세 모달이 원래 하드코딩해 쓰던 값을 그대로 토큰화. */
    scrim: 'rgba(15, 8, 25, 0.72)',
    /** 모달 카드처럼 배경이 완전히 비쳐 보이면 안 되는 서피스용 - surfaceCard(반투명)와 구분. */
    surfaceCardOpaque: '#FFFCF5',
    /** text-field 입력창/checkbox 박스/StaffHomePage 카드가 각자 '#FFFFFF'로 하드코딩하던
     * 순백 서피스 - 크림톤인 surfaceCardOpaque(#FFFCF5)와 구분되는 순수한 흰색이 필요한 곳. */
    surfaceWhite: '#FFFFFF',
    /**
     * 레거시 인증/대시보드 페이지들의 "라이트 셸" 계열 - storybookTheme이 처음 나올 때
     * "기존 인증 페이지들에는 소급 적용하지 않는다"고 명시했던 바로 그 페이지들(로그인/회원가입/
     * 대시보드/staff)을 이번에 소급 적용하면서 추가한다. onLightHeading은 값이 primary와
     * 우연히 같지만("브랜드 버튼 채우기"가 아니라 "밝은 카드 위 제목") 의미가 달라 별도 토큰으로
     * 둔다 - 나중에 둘이 갈라져도 여기서만 바꾸면 된다.
     */
    shellBackground: '#F7F1FB',
    onLightHeading: '#43225F',
    onLightBody: '#6B5478',
    /** WCAG AA 4.5:1을 만족하도록 조정한 값(원래 #9C87AC는 흰 배경 3.24:1, shellBackground 2.92:1로 미달). */
    onLightMuted: '#6F5D85',
    lightCardBorder: '#E0D3EA',
    linkOnDark: '#DCD1FF',
    linkOnLight: '#6A4B7C',
    /**
     * 에러/위험 상태 - 이전엔 토큰이 아예 없어서 파일마다 같은 값을 새로 하드코딩했다.
     * WCAG AA 4.5:1을 만족하도록 흰 배경 기준으로 조정(원래 #E46647은 3.34:1로 미달).
     */
    error: '#C24A2E',
    /** brand-lockup의 로고 프레임과 리더 top-bar의 brandLogoFrame이 각자 하드코딩하던 동일한 값. */
    brandFrameBackground: 'rgba(255, 249, 237, 0.96)',
    /** 어두운 배경 위의 반투명 패널 - HomePage/ParentHomePage/ClassDashboardPage가 각자 하드코딩하던 값. */
    panelOnDarkBackground: 'rgba(255, 252, 245, 0.08)',
    panelOnDarkBorder: 'rgba(255, 252, 245, 0.16)',
    /**
     * 폼 필드(TextField 등)의 비활성 상태 - Figma "Simple Design System"의 중립 회색
     * disabled 팔레트를 그대로 쓰지 않고, 라이트 셸의 보라 톤(primary #43225F)에서 파생시켜
     * 톤을 맞췄다. pillBackground/pillBorder와 비슷한 유도 방식이다.
     */
    disabledBackground: 'rgba(67, 34, 95, 0.06)',
    disabledBorder: 'rgba(67, 34, 95, 0.18)',
    disabledText: '#A79BB0',
    /**
     * 리더(one-story) 전용 톤 - 리더는 씬마다 다양한 tint를 쓰기 때문에 palette가 넓지만,
     * 아래 6개 톤은 리더 여러 화면(제목/카드/그림자/본문 3단)에서 반복적으로 나와 별도 토큰으로
     * 뒀다. 브랜드 primary(#43225F)보다 각각 조금 어둡거나 밝은 파생이라 primary로 대체할 수
     * 없다 - 리더의 크림 배경 위 대비를 위해 별도 톤이 필요.
     */
    readerHeading: '#28153F',     // heroTitle/panelTitle/recordingTitle/loadingTitle
    readerBodyStrong: '#2D1948',  // 리포트의 강조 본문(질문 텍스트/번호)
    readerBody: '#35204D',        // 리포트 pill/coach summary 본문
    readerBodyMuted: '#746987',   // 리포트 hero body/panel description 등 보조 본문
    readerShadow: '#2E1948',      // 리포트 카드/topBar 전용 그림자 (전역 shadow #12091F보다 밝음)
    readerCard: '#FFF7E9',        // 리포트 카드 배경 (surfaceCardOpaque #FFFCF5보다 따뜻한 크림)
  },
  /**
   * 시맨틱 컬러 램프 - Figma "Simple Design System" 커뮤니티 파일의 구조(카테고리별
   * default/secondary/hover/on-X)를 참고해 추가했지만, 값 자체는 그 파일의 회색조 팔레트가
   * 아니라 위 브랜드 컬러(보라 #43225F, 골드 #F6C64D, 크림 카드, 다크 배경)에서 파생시켰다.
   * 완전히 추가적인 네임스페이스라 기존 color.* / status.* 키는 하나도 건드리지 않는다.
   *
   * danger는 새 색이 아니라 기존 error(#C24A2E)/status.warning과 같은 값이다 - 조사해보니
   * status.warning의 배경/테두리/텍스트(#FBEAE3/#F0C3AE/#AC4A2A)가 실제로는 빨강 계열이라
   * 시각적으로 "경고"보다 "위험"에 가까웠다. 이미 여러 화면이 그 의미로 쓰고 있어 status.warning
   * 자체는 그대로 두고, 여기 danger에 같은 값을 재사용해 의미만 명확히 하고, warning에는
   * 앱에 없던 진짜 노란 "주의" 색을 새로 만들었다. positive도 앱에 성공/긍정 색이 아직
   * 없어서 완전히 새로 만든 값이다.
   */
  semantic: {
    brand: {
      default: '#43225F',
      hover: '#341A4B',
      secondary: 'rgba(67, 34, 95, 0.08)',
      onBrand: '#FFFFFF',
      onBrandMuted: 'rgba(255, 255, 255, 0.72)',
    },
    /** 골드 CTA 전용 계열 - brand(보라)와 별개로 둔다. */
    accent: {
      default: '#F6C64D',
      hover: '#E8B93D',
      onAccent: '#2B1748',
    },
    neutral: {
      onDark: { default: '#FFFFFF', muted: 'rgba(255, 255, 255, 0.72)' },
      onLight: { default: '#43225F', body: '#6B5478', muted: '#6F5D85' },
      onCard: { title: '#2B1748', body: '#5E5367', muted: '#7A6C82' },
    },
    positive: {
      default: '#2F9E62',
      background: '#E6F6EC',
      border: '#BFE6CC',
      text: '#1F7A48',
    },
    warning: {
      default: '#E8B931',
      background: '#FFF7DA',
      border: '#F3DE9C',
      text: '#7A5B05',
    },
    danger: {
      default: '#C24A2E',
      background: '#FBEAE3',
      border: '#F0C3AE',
      text: '#AC4A2A',
    },
  },
  /**
   * 경고/정보 배너 한 벌 - organization-signup의 구독 상태 카드, staff-scene의 "stale" 카드가
   * 각자 미묘하게 다른 근접값을 하드코딩하고 있던 것을 하나로 수렴시킨다. warning은 두 페이지가
   * 공유하는 값(조직가입의 경고 variant 그대로) - staff-scene의 근소하게 다른 배경색은 여기로
   * 수렴한다.
   */
  status: {
    info: {
      background: '#EDE3F6',
      border: '#D9C7EC',
    },
    warning: {
      background: '#FBEAE3',
      border: '#F0C3AE',
      /** WCAG AA 4.5:1을 만족하도록 조정한 값(원래 #B24E2E는 배경 대비 4.47:1로 근소 미달). */
      text: '#AC4A2A',
    },
  },
  /**
   * 라운드 토큰. 처음엔 카드/모달/로고 모두 8px 하나로 통일했었지만, 토스 UI 스타일 정돈
   * 과정에서 카드/모달의 부드러운 라운드가 다크 배경 위 크림 서피스의 무게감을 낮춰 준다는
   * 점을 반영해 카드 = 16, 모달 = 20으로 올렸다. 입력창/버튼용 radius도 명시적으로 뒀다 -
   * ActionButton/TextField가 각자 17/12 등을 하드코딩하던 것을 여기로 수렴시킨다. `pill`은
   * 여전히 "완전히 둥글게" 의도라 별개, `control`(체크박스/라디오)은 그대로 4.
   */
  radius: {
    card: 16,
    pill: 999,
    logoFrame: 12,
    modalCard: 20,
    /** 기본 버튼 radius - ActionButton primary/gold가 하드코딩하던 17을 대체한다. */
    button: 14,
    /** 입력창 radius - TextField/SearchField가 하드코딩하던 12를 명시. */
    input: 12,
    /** 체크박스/라디오 컨트롤 박스 전용 - Figma "Simple Design System"의 radius-100(4px). */
    control: 4,
  },
  /**
   * 화면에 겹쳐지는 것들의 쌓임 순서. one-story 리더가 이미 쓰던 두 값(5, 20)을 그대로
   * 이름 붙였을 뿐 - Solid 2.0처럼 5단계를 억지로 채우지 않고, 실제로 쓰는 만큼만 둔다.
   */
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
  /**
   * 파일마다 흩어져 있던 임의의 fontSize 값(12/13/14/15/17/18/22/24/25/26)을 대체하는
   * 스케일 - 각 화면이 하나의 스케일을 공유하는 대신 "대충 비슷한" 숫자를 골라 쓰고 있어서,
   * 같은 시스템으로 보여야 할 화면들 사이에 위계가 미묘하게 어긋나 있었다. md/lg는 Figma
   * "Simple Design System"의 Body Medium(16)/Heading(24)에 맞춰 조정했다 - sm(14)은
   * 이미 그 시스템의 Body Small과 일치했고, xs/xl/xxl은 대응되는 계층이 없어 그대로 둔다.
   */
  type: {
    xxs: 11, // 뱃지/키커 같은 초소형 텍스트 - HomePage/LandingPage가 11~11.5로 각자 하드코딩하던 값
    xs: 12, // eyebrow/caption/pill 레이블
    sm: 14, // 보조 본문 텍스트, 작은 버튼
    md: 16, // 주요 본문 텍스트, 카드 제목
    lg: 24, // 섹션 헤더
    xl: 26, // 페이지 헤드라인
    xxl: 32, // 히어로 순간에만 사용
    /** RN fontWeight는 문자열이어야 해서 숫자가 아니라 문자열 맵으로 둔다. */
    weight: {
      /** story-card 설명문/section-header 서브타이틀이 각자 하드코딩하던 값. */
      light: '300',
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      /** HomePage/ClassDashboardPage/ParentHomePage의 큰 강조 숫자·타이틀류가 공유하는 값. */
      black: '900',
    },
  },
  /**
   * Figma 시스템은 헤딩류(md/lg 이상)엔 타이트한 줄간격+음수 자간을, 본문류(xs/sm)엔
   * 여유있는 줄간격을 쓰는 구조를 갖고 있다 - 지금까지는 화면마다 lineHeight를 따로
   * 하드코딩했는데, 그 두 갈래를 토큰으로 명시해 둔다. 기존 숫자 fontSize 사용처는 그대로
   * 동작하고, 이 토큰은 새로 손대는 곳부터 짝지어 적용한다.
   */
  lineHeight: {
    tight: 1.2, // 헤딩(md 이상)
    normal: 1.4, // 본문(xs/sm)
  },
  tracking: {
    heading: -0.02, // 헤딩류에 쓰는 음수 자간 (fontSize * -0.02)
    none: 0,
  },
  /**
   * 각 카드가 shadowOpacity/shadowRadius를 개별적으로 정하는 대신 두 단계의 elevation을 둔다.
   * 둘 다 예전에 모든 곳에 복사되던 0.28~0.32 불투명도보다 의도적으로 더 가볍게 잡았다 -
   * 모든 카드에 진한 드롭 섀도를 넣으면 촌스러워 보인다; 요즘 서피스는 극적인 그림자 대신
   * 얇은 테두리와 부드럽고 낮은 들뜸(lift)에 기댄다.
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
    /** modal.tsx가 자체적으로 하드코딩하던 카드 그림자를 그대로 옮긴 세 번째 단계 - low/high보다 진하다. */
    modal: {
      shadowColor: '#12091F',
      shadowOpacity: 0.22,
      shadowRadius: 40,
      shadowOffset: { width: 0, height: 18 },
    },
  },
  /** Figma "Simple Design System"에서 확인한 4px 배수 스케일(8/12/16/24) - sm과 md 사이,
   * lg와 xl 사이에 있던 빈 칸(12, 20)을 채워 완전한 사다리로 만들었다. 히어로/대시보드에서
   * 넉넉한 여백이 필요할 때 쓸 상위 두 단계(xxl=40, xxxl=56)도 함께. */
  spacing: {
    xs: 4,
    sm: 8,
    ms: 12,
    md: 16,
    ml: 20,
    lg: 24,
    xl: 32,
    xxl: 40,
    xxxl: 56,
  },
  /**
   * 기존 인증 페이지들(login/join/organization-signup/class-dashboard/parent-home)이 이미 각자
   * content wrapper에 `maxWidth: 420, width: '100%', alignSelf: 'center'`로 하드코딩해 둔
   * 것과 같은 420 값이다 - 새 단일 컬럼 페이지들이 비슷하지만 다른 숫자를 고르는 대신
   * 정확히 일치시키도록 여기 중앙화했다. `wide`는 읽는 컬럼이 아니라 다중 아이템 그리드인
   * 유일한 화면(홈 서재)을 위한 값이다.
   */
  layout: {
    contentMaxWidth: 420,
    wideMaxWidth: 1040,
    /** ClassDashboardPage/ParentHomePage가 각자 640/760으로 하드코딩해 둔 히어로 카드 폭 - 두
     * 화면이 정확히 같은 값을 쓰고 있어 중앙화한다. */
    dashboardCardMaxWidth: 640,
    dashboardCardWideMaxWidth: 760,
    /**
     * 학생/일정 리스트처럼 카드 나열 위주지만 폼(420)보다는 넓고 대시보드(640)보다는 좁은
     * 중간 밀도 페이지의 폭 - TutorStudentsPage/TutorScheduleListPage 등이 각자 560으로
     * 하드코딩하던 값을 중앙화. */
    narrowMaxWidth: 560,
    /**
     * 튜터 홈처럼 콘텐츠 밀도가 높지만 라이브러리 그리드(1040)만큼 넓을 필요는 없는 페이지의
     * 폭 - TutorHomePage/TutorStudentNewPage/TutorLessonDetailPage 등이 각자 720으로
     * 하드코딩하던 값을 중앙화. */
    tabletMaxWidth: 720,
  },
} as const;
