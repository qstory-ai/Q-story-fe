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
    onCardMuted: '#85778E',
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
    onLightMuted: '#9C87AC',
    lightCardBorder: '#E0D3EA',
    linkOnDark: '#DCD1FF',
    linkOnLight: '#6A4B7C',
    /** 에러/위험 상태 - 이전엔 토큰이 아예 없어서 파일마다 같은 값을 새로 하드코딩했다. */
    error: '#E46647',
    /** brand-lockup의 로고 프레임과 리더 top-bar의 brandLogoFrame이 각자 하드코딩하던 동일한 값. */
    brandFrameBackground: 'rgba(255, 249, 237, 0.96)',
    /** 어두운 배경 위의 반투명 패널 - HomePage/ParentHomePage/ClassDashboardPage가 각자 하드코딩하던 값. */
    panelOnDarkBackground: 'rgba(255, 252, 245, 0.08)',
    panelOnDarkBorder: 'rgba(255, 252, 245, 0.16)',
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
      text: '#B24E2E',
    },
  },
  radius: {
    card: 24,
    pill: 999,
    logoFrame: 14,
    /** 모달 카드 전용 - card(24)와 다른 서피스 종류라 별도 토큰으로 둔다. */
    modalCard: 26,
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
   * 1.25 비율 모듈러 스케일 - 각 화면이 하나의 스케일을 공유하는 대신 "대충 비슷한" 숫자를
   * 골라 쓰고 있어서, 같은 시스템으로 보여야 할 화면들 사이에 위계가 미묘하게 어긋나 있었다.
   */
  type: {
    xs: 12, // eyebrow/caption/pill 레이블
    sm: 14, // 보조 본문 텍스트, 작은 버튼
    md: 17, // 주요 본문 텍스트, 카드 제목
    lg: 21, // 섹션 헤더
    xl: 26, // 페이지 헤드라인
    xxl: 32, // 히어로 순간에만 사용
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
      shadowOpacity: 0.1,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    high: {
      shadowColor: '#12091F',
      shadowOpacity: 0.16,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
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
  },
} as const;
