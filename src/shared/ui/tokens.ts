import { BODY_LINE_HEIGHT, cssVariableEntries, primitives as figma, renderDesignTokensCss, typography as figmaTypography } from './design-tokens';

/**
 * Q-Story 디자인 토큰 3계층 - Raw → Primitive → Semantic(+ 간격·라운드·그림자·글꼴·아이콘·반응형).
 * 방향은 항상 Semantic → Primitive → Raw다. 화면·컴포넌트는 **Semantic(`semanticColors`, `space`, `radius`, `elevation`,
 * `textStyles`, `iconSize`, `responsive`)만** 쓴다. Raw·Primitive는 이 파일 안에서만 참조한다.
 *
 * - Raw: Figma 변수 34개(`design-tokens.ts`, 단일 출처 design/figma-variables.json) + Figma에 아직 없는 값(`rawExtensions`).
 * - Primitive: 역할 이름. brand = Purple, info = Skyblue, success = Green, error = Pink, neutral = Neutral.
 *   warning은 Figma에 노랑 계열이 없어 **정의 보류**(디자인 요청).
 * - Semantic: 용도 이름. Light(콘솔 세계) / Dark(리더 - 어두운 화면) 두 모드.
 *
 * 기존 `theme.ts`(`storybookTheme`)의 이름들은 이 Semantic의 별칭으로 남겨 두고 화면마다 점진적으로 옮긴다.
 * 대응표·디자인 요청 목록: qstory/docs/planning/디자인-시스템.md 7장.
 */

// ── Raw ─────────────────────────────────────────────────────────────────────────────────────────
/**
 * Figma 변수에 아직 없는 값. 지금 화면이 쓰는 값이라 남겨 두었고, Figma에 단계가 추가되면 그 값으로 바꾼다
 * (각 항목이 디자인 요청 목록과 1:1이다). 새 값을 여기에 함부로 늘리지 않는다.
 */
export const rawExtensions = {
  /** 리더 어두운 바탕·전역 그림자 색(theme.ts shadow). */
  ink: '#12091f',
  black: '#000000',
  /** 성공 - Green 700(#45996c)은 흰 바탕 3.48:1이라 글자에 못 쓴다. 진한 초록·옅은 초록 요청. */
  green: { 50: '#e6f6ec', 200: '#bfe6cc', 600: '#2f9e62', 800: '#1f7a48' },
  /** 오류 배너 바탕·테두리 - 옅은 분홍 요청. */
  pink: { 50: '#fbeae3', 200: '#f0c3ae' },
} as const;

/** primitive hex에 투명도를 얹는다(theme.ts와 같은 표기 - 대비 테스트가 rgba를 읽는다). */
export function alpha(hex: string, opacity: number): string {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// ── Primitive ───────────────────────────────────────────────────────────────────────────────────
/**
 * 역할 이름 → Raw. 브랜드 색을 바꾸려면 여기 `brand`만 다른 Raw로 바꾼다.
 * Figma에 없는 단계(brand 600·700, neutral 200·400)는 만들어 채우지 않는다 - Semantic에서 가까운 단계로 대체하고 문서에 적었다.
 */
export const palette = {
  base: { white: figma.base.white, ivory: figma.base.ivory, ink: rawExtensions.ink, black: rawExtensions.black },
  brand: figma.purple,
  info: figma.skyblue,
  success: { ...figma.green, ...rawExtensions.green },
  error: { ...figma.pink, ...rawExtensions.pink },
  neutral: figma.neutral,
  // warning: 정의 보류 - Figma에 노랑/주황 계열이 없다(디자인 요청).
} as const;

const p = palette;

// ── Semantic: 색 ────────────────────────────────────────────────────────────────────────────────
type InteractiveSet = { default: string; hover: string; pressed: string };
const states = (d: string, hover: string, pressed: string): InteractiveSet => ({ default: d, hover, pressed });

export type SemanticColors = {
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    disabled: string;
    /** 진한 바탕(bg.inverse) 위 글자. 채운 버튼 글자는 interactive.inverse를 쓴다(다른 토큰). */
    inverse: string;
    /** 본문 사이 링크 - 밑줄과 함께 쓴다. Q-Story 확장. */
    link: string;
    /** bg.warm(아이보리 카드) 위 글자 - 두 모드 모두 진한 글자. Q-Story 확장. */
    onWarm: string;
    info: string;
    success: string;
    error: string;
    interactive: {
      primary: InteractiveSet;
      secondary: InteractiveSet;
      /** 채운 버튼(bg.interactive.primary·error) 위 글자. */
      inverse: string;
      selected: string;
    };
  };
  bg: {
    /** 카드·시트·입력창 */
    primary: string;
    /** 페이지 바탕 */
    secondary: string;
    /** 카드 안 서브 패널·칩 */
    tertiary: string;
    /** 따뜻한 바탕(랜딩·리더 크림 카드). 두 모드 모두 아이보리 - 위 글자는 text.onWarm. Q-Story 확장. */
    warm: string;
    /** 글자 없는 강조 채움·마커(진행 막대, 캘린더 오늘, 활성 아이콘 점) - 바탕 대비 3:1. Q-Story 확장. */
    indicator: string;
    /** 녹음·재생 중 점·음량 막대 - 글자 없는 채움. Q-Story 확장. */
    recording: string;
    brand: string;
    brandSubtle: string;
    inverse: string;
    disabled: string;
    info: string;
    infoBold: string;
    infoSubtle: string;
    success: string;
    successBold: string;
    successSubtle: string;
    error: string;
    errorBold: string;
    errorSubtle: string;
    interactive: {
      primary: InteractiveSet;
      secondary: InteractiveSet;
      error: InteractiveSet;
      selected: InteractiveSet;
    };
  };
  border: {
    /** 입력창처럼 경계가 보여야 하는 UI(3:1). */
    primary: string;
    /** 카드 hairline·구분선(장식 - 대비 기준 없음). */
    secondary: string;
    disabled: string;
    /** 키보드 포커스 링. */
    focus: string;
    info: string;
    infoSubtle: string;
    success: string;
    successSubtle: string;
    error: string;
    errorSubtle: string;
    interactive: { primary: InteractiveSet; neutral: InteractiveSet };
  };
  icon: {
    primary: string;
    secondary: string;
    brand: string;
    disabled: string;
    info: string;
    success: string;
    error: string;
    interactive: { primary: InteractiveSet; secondary: InteractiveSet; inverse: string };
  };
};

/**
 * Light - 콘솔 세계(인증·온보딩·대시보드·리포트·마이페이지).
 * 상호작용 상태: hanbit 원본은 brand 500 → 600 → 700인데 Figma에 600·700이 없어 hover·pressed 모두 Purple 800(흰 글자 6.94:1).
 */
export const lightColors: SemanticColors = {
  text: {
    primary: p.neutral[900],
    secondary: p.neutral[700],
    /** bg.primary·secondary·brandSubtle 위 4.5:1 이상. bg.tertiary(4.45)·errorSubtle(4.30) 위에는 쓰지 않는다. */
    tertiary: p.neutral[600],
    // hanbit 원본(neutral 400)은 대비 2.6:1이라 Q-Story는 비활성 라벨도 읽히게 Neutral 600(bg.disabled 위 4.75:1).
    disabled: p.neutral[600],
    inverse: p.neutral[50],
    link: p.brand[800],
    onWarm: p.neutral[900],
    /** 흰 바탕(bg.primary) 전용 - bg.secondary 위 4.30:1. 정보 배너(bg.infoSubtle) 안 글자는 text.secondary. */
    info: p.info[700],
    success: p.success[800],
    error: p.error[700],
    interactive: {
      primary: states(p.brand[500], p.brand[800], p.brand[800]),
      secondary: states(p.neutral[600], p.neutral[700], p.neutral[800]),
      inverse: p.base.white,
      selected: p.brand[800],
    },
  },
  bg: {
    primary: p.base.white,
    secondary: p.neutral[50],
    tertiary: p.neutral[100],
    warm: p.base.ivory,
    indicator: p.brand[400],
    // 밝은 바탕에서는 Pink 500이 3:1에 못 미쳐(흰 바탕 2.9) 진한 단계.
    recording: p.error[700],
    brand: p.brand[500],
    brandSubtle: p.brand[50],
    inverse: p.neutral[900],
    disabled: p.neutral[50],
    info: p.info[700],
    infoBold: p.info[700],
    infoSubtle: alpha(p.info[500], 0.1),
    /** 채움·점·막대 전용(흰 글자 3.39:1) - 글자를 얹는 채움은 successBold. */
    success: p.success[600],
    successBold: p.success[800],
    successSubtle: p.success[50],
    error: p.error[700],
    errorBold: p.error[700],
    errorSubtle: p.error[50],
    interactive: {
      primary: states(p.brand[500], p.brand[800], p.brand[800]),
      /** 옅은 보라 버튼 - 글자는 text.interactive.selected(Purple 800, 5.54:1 이상). Purple 500 글자는 hover 바탕에서 4.36이라 안 된다. */
      secondary: states(p.brand[50], p.brand[100], p.brand[100]),
      error: states(p.error[700], p.error[700], p.error[700]),
      selected: states(p.brand[50], p.brand[100], p.brand[100]),
    },
  },
  border: {
    primary: p.neutral[500],
    secondary: p.neutral[300],
    disabled: p.neutral[300],
    focus: p.brand[800],
    info: p.info[700],
    infoSubtle: alpha(p.info[500], 0.35),
    success: p.success[600],
    successSubtle: p.success[200],
    error: p.error[700],
    errorSubtle: p.error[200],
    interactive: {
      primary: states(p.brand[500], p.brand[800], p.brand[800]),
      neutral: states(p.neutral[600], p.neutral[700], p.neutral[800]),
    },
  },
  icon: {
    primary: p.neutral[800],
    secondary: p.neutral[600],
    brand: p.brand[500],
    disabled: p.neutral[500],
    info: p.info[700],
    success: p.success[700],
    error: p.error[700],
    interactive: {
      primary: states(p.brand[500], p.brand[800], p.brand[800]),
      secondary: states(p.neutral[600], p.neutral[700], p.neutral[800]),
      inverse: p.base.white,
    },
  },
};

/**
 * Dark - 리더(one-story)·어두운 화면. hanbit 규칙대로 상호작용 상태는 밝아지는 방향(400 → 300 → 200).
 * 채운 강조 버튼은 Purple 400 + Neutral 900 글자(흰 글자는 3.4:1이라 쓰지 않는다).
 */
export const darkColors: SemanticColors = {
  text: {
    primary: p.base.white,
    secondary: p.neutral[100],
    tertiary: p.neutral[300],
    // 반투명 bg.disabled를 어느 어두운 표면에 얹어도 4.5:1 - 상태는 바탕·테두리로 구분한다.
    disabled: p.neutral[300],
    inverse: p.neutral[900],
    link: p.brand[200],
    onWarm: p.neutral[900],
    info: p.info[500],
    success: p.success[500],
    error: p.error[500],
    interactive: {
      primary: states(p.brand[200], p.brand[100], p.brand[50]),
      secondary: states(p.neutral[300], p.neutral[100], p.neutral[50]),
      inverse: p.neutral[900],
      selected: p.brand[200],
    },
  },
  bg: {
    primary: p.base.ink,
    secondary: p.brand[900],
    // Neutral 800은 Pink 500 글자가 4.02라 한 단계 어둡게.
    tertiary: p.neutral[900],
    warm: p.base.ivory,
    indicator: p.brand[400],
    recording: p.error[500],
    brand: p.brand[400],
    brandSubtle: alpha(p.brand[400], 0.16),
    inverse: p.base.ivory,
    disabled: alpha(p.base.white, 0.08),
    info: p.info[500],
    infoBold: p.info[500],
    infoSubtle: alpha(p.info[500], 0.16),
    success: p.success[500],
    successBold: p.success[500],
    successSubtle: alpha(p.success[500], 0.16),
    error: p.error[500],
    errorBold: p.error[500],
    /** 다크 오류 배너 바탕 - 안의 글자는 text.primary(흰), 오류 색은 아이콘(icon.error)으로만. */
    errorSubtle: alpha(p.error[500], 0.16),
    interactive: {
      primary: states(p.brand[400], p.brand[300], p.brand[200]),
      secondary: states(alpha(p.base.white, 0.08), alpha(p.base.white, 0.12), alpha(p.base.white, 0.16)),
      error: states(p.error[500], p.error[500], p.error[500]),
      selected: states(alpha(p.brand[400], 0.16), alpha(p.brand[400], 0.28), alpha(p.brand[400], 0.36)),
    },
  },
  border: {
    primary: p.neutral[500],
    secondary: alpha(p.base.white, 0.16),
    disabled: p.neutral[700],
    focus: p.brand[200],
    info: p.info[500],
    infoSubtle: alpha(p.info[500], 0.35),
    success: p.success[500],
    successSubtle: alpha(p.success[500], 0.35),
    error: p.error[500],
    errorSubtle: alpha(p.error[500], 0.35),
    interactive: {
      primary: states(p.brand[400], p.brand[300], p.brand[200]),
      neutral: states(p.neutral[300], p.neutral[100], p.neutral[50]),
    },
  },
  icon: {
    primary: p.neutral[50],
    secondary: p.neutral[300],
    brand: p.brand[300],
    disabled: p.neutral[500],
    info: p.info[500],
    success: p.success[500],
    error: p.error[500],
    interactive: {
      primary: states(p.brand[300], p.brand[200], p.brand[100]),
      secondary: states(p.neutral[300], p.neutral[100], p.neutral[50]),
      inverse: p.neutral[900],
    },
  },
};

export const semanticColors = { light: lightColors, dark: darkColors } as const;
export type ColorMode = keyof typeof semanticColors;

// ── Spacing · Radius ────────────────────────────────────────────────────────────────────────────
/** 4px 배수 간격(2는 아이콘·글자 미세 조정용). 섹션 사이 40~64, 폼 필드 사이 24, 버튼 묶음 안 12. */
export const space = {
  0: 0, 2: 2, 4: 4, 8: 8, 12: 12, 16: 16, 20: 20, 24: 24, 32: 32, 36: 36, 40: 40,
  48: 48, 56: 56, 64: 64, 72: 72, 80: 80, 96: 96, 112: 112, 128: 128,
} as const;

/** 모서리. 랜딩 카드는 16·32, 버튼·칩은 rounded. */
export const radius = { 0: 0, 2: 2, 4: 4, 6: 6, 8: 8, 12: 12, 16: 16, 32: 32, rounded: 9999 } as const;

/** 선 두께. hanbit 원본의 thickness/1 → Unit/0 오류는 고쳐서 1로 둔다. */
export const borderWidth = { 1: 1, 2: 2, 4: 4 } as const;

// ── Elevation ───────────────────────────────────────────────────────────────────────────────────
/**
 * 그림자 0~5 - 레벨마다 2겹(x 0, spread 0), hanbit 기하(A: y/blur, B: y/blur)에 랜딩처럼 Neutral 900 기운의 옅은 색.
 * 색 농도(Light 0.12/0.08, Dark 0.28/0.24)는 랜딩 카드 그림자(약 0.14)에 맞춘 가정값 - Figma 확인 필요.
 * react-native-web은 boxShadow 문자열을 그대로 받는다.
 */
const ELEVATION_GEOMETRY = [
  null,
  [0, 1, 1, 1],
  [1, 3, 3, 3],
  [3, 6, 6, 6],
  [6, 8, 8, 8],
  [8, 12, 12, 12],
] as const;

function elevationSet(colorA: string, colorB: string) {
  return ELEVATION_GEOMETRY.map((g) =>
    g === null ? 'none' : `0px ${g[0]}px ${g[1]}px 0px ${colorA}, 0px ${g[2]}px ${g[3]}px 0px ${colorB}`,
  ) as unknown as readonly [string, string, string, string, string, string];
}

export const elevation = {
  light: elevationSet(alpha(p.neutral[900], 0.12), alpha(p.neutral[900], 0.08)),
  dark: elevationSet(alpha(p.base.black, 0.28), alpha(p.base.black, 0.24)),
} as const;

/** 입력창 포커스 링(랜딩 입력창과 같은 옅은 보라 3px) - 테두리 두께를 바꾸지 않아 레이아웃이 밀리지 않는다. */
export const focusRing = {
  light: `0px 0px 0px 3px ${alpha(p.brand[500], 0.15)}`,
  dark: `0px 0px 0px 3px ${alpha(p.brand[300], 0.35)}`,
} as const;

/** RN 스타일로 쓰는 그림자 - `...shadow(3)`. */
export function shadow(level: 0 | 1 | 2 | 3 | 4 | 5, mode: ColorMode = 'light'): { boxShadow: string } {
  return { boxShadow: elevation[mode][level] };
}

// ── Typography ──────────────────────────────────────────────────────────────────────────────────
export type TextStyleToken = { fontSize: number; lineHeight: number; fontWeight: '400' | '500' | '600' | '700'; letterSpacing: number };

const fromFigma = (key: keyof typeof figmaTypography, override: Partial<TextStyleToken> = {}): TextStyleToken => {
  const s = figmaTypography[key];
  return { fontSize: s.fontSize, lineHeight: s.lineHeight, fontWeight: s.fontWeight, letterSpacing: s.letterSpacing, ...override };
};

/**
 * 글꼴 스타일 - Desktop은 Figma 텍스트 스타일 그대로, Mobile은 Figma에 모드가 없어 hanbit 규칙(제목만 한두 단계 줄임)으로 만든 가정값.
 * Body 행간은 Figma가 100(=16px)으로 줘서 한글 본문이 빽빽해지므로 24로 둔다(가정 - 디자이너 확인 요청).
 * 744(태블릿)는 Desktop을 쓴다.
 */
const desktopText = {
  display: fromFigma('display'),
  heading1: fromFigma('heading1'),
  heading2: fromFigma('heading2'),
  heading3: fromFigma('heading3'),
  heading4: fromFigma('heading4'),
  bodyLarge: fromFigma('bodyLarge'),
  body: fromFigma('body', { lineHeight: BODY_LINE_HEIGHT }),
  bodySmall: fromFigma('bodySmall'),
  caption: { fontSize: 12, lineHeight: 18, fontWeight: '500', letterSpacing: 0 },
} satisfies Record<string, TextStyleToken>;

const mobileText: Record<keyof typeof desktopText, TextStyleToken> = {
  display: fromFigma('display', { fontSize: 40, lineHeight: 50, letterSpacing: -0.4 }),
  heading1: fromFigma('heading1', { fontSize: 30, lineHeight: 40, letterSpacing: -0.3 }),
  heading2: fromFigma('heading2', { fontSize: 26, lineHeight: 34, letterSpacing: -0.26 }),
  heading3: fromFigma('heading3', { fontSize: 20, lineHeight: 28 }),
  heading4: fromFigma('heading4', { fontSize: 20, lineHeight: 26 }),
  bodyLarge: desktopText.bodyLarge,
  body: desktopText.body,
  bodySmall: desktopText.bodySmall,
  caption: desktopText.caption,
};

export const textStyles = { desktop: desktopText, mobile: mobileText } as const;
export type TextStyleName = keyof typeof desktopText;

// ── Icon size · Responsive ──────────────────────────────────────────────────────────────────────
export const iconSize = { sm: 16, '1x': 24, '1.5x': 36, '2x': 48 } as const;

/** 터치 영역 최소(아이가 누르는 컨트롤 포함). */
export const minTouchTarget = 44;

export const responsive = {
  /** Figma 프레임 너비. 태블릿(744)이 Q-Story의 기준 화면이다. */
  frame: { desktop: 1280, tablet: 744, mobile: 402 },
  /** 페이지 좌우 여백. */
  paddingX: { desktop: 64, tablet: 32, mobile: 16 },
} as const;
export type ResponsiveMode = keyof typeof responsive.frame;

/** 화면 너비 → 모드. 744 이상 태블릿, 1280 이상 데스크톱. */
export function responsiveMode(width: number): ResponsiveMode {
  if (width >= responsive.frame.desktop) return 'desktop';
  if (width >= responsive.frame.tablet) return 'tablet';
  return 'mobile';
}

/** 모드에 맞는 글꼴 세트 - 태블릿은 데스크톱 크기를 쓴다. */
export function textStylesFor(width: number) {
  return responsiveMode(width) === 'mobile' ? textStyles.mobile : textStyles.desktop;
}

// ── CSS 변수 ────────────────────────────────────────────────────────────────────────────────────
const kebab = (s: string) => s.replace(/([a-z])([A-Z0-9])/g, '$1-$2').toLowerCase();

/** Figma에 없는 Raw 값의 CSS 이름. ink는 랜딩의 --ink(#241839, 글자색)와 다른 값이라 이름을 달리한다. */
function rawExtensionCssEntries(): Array<[string, string]> {
  return [
    ['--ink-reader', rawExtensions.ink],
    ['--black', rawExtensions.black],
    ...Object.entries(rawExtensions.green).map(([k, v]) => [`--ext-green-${k}`, v] as [string, string]),
    ...Object.entries(rawExtensions.pink).map(([k, v]) => [`--ext-pink-${k}`, v] as [string, string]),
  ];
}

/** hex → 그 값을 가진 Raw CSS 변수 이름. Semantic CSS가 값을 다시 적지 않고 Raw를 참조하게 한다. */
function rawVarByHex(): Map<string, string> {
  const map = new Map<string, string>();
  for (const [name, value] of [...cssVariableEntries(), ...rawExtensionCssEntries()]) {
    if (/^#[0-9a-f]{6}$/i.test(value) && !map.has(value.toLowerCase())) map.set(value.toLowerCase(), name);
  }
  return map;
}

/** '#rrggbb' → var(--x), 'rgba(r, g, b, a)' → color-mix(in srgb, var(--x) a%, transparent). 문자열 안 여러 개도 바꾼다. */
function toVarRefs(value: string, map: Map<string, string>): string {
  const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
  return value
    .replace(/rgba\((\d+), (\d+), (\d+), ([\d.]+)\)/g, (whole, r, g, b, a) => {
      const name = map.get(hex(Number(r), Number(g), Number(b)));
      return name ? `color-mix(in srgb, var(${name}) ${Math.round(Number(a) * 100)}%, transparent)` : whole;
    })
    .replace(/#[0-9a-f]{6}\b/gi, (h) => {
      const name = map.get(h.toLowerCase());
      return name ? `var(${name})` : h;
    });
}

function flatten(node: unknown, prefix: string, out: Array<[string, string]>) {
  if (typeof node === 'string') {
    out.push([prefix, node]);
    return;
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    flatten(value, key === 'default' ? prefix : `${prefix}-${kebab(key)}`, out);
  }
}

/** Semantic 이름 그대로 CSS 변수로: text.interactive.primary.hover → --color-text-interactive-primary-hover. 값은 Raw 변수 참조. */
export function semanticCssEntries(mode: ColorMode): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  flatten(semanticColors[mode], '--color', out);
  elevation[mode].forEach((value, level) => out.push([`--elevation-${level}`, value]));
  out.push(['--focus-ring-shadow', focusRing[mode]]);
  const map = rawVarByHex();
  return out.map(([name, value]) => [name, toVarRefs(value, map)]);
}

const px = (n: number) => (n === 0 ? '0' : `${n}px`);

export function scaleCssEntries(): Array<[string, string]> {
  return [
    ...Object.entries(space).map(([k, v]) => [`--space-${k}`, px(v)] as [string, string]),
    ...Object.entries(radius).map(([k, v]) => [`--radius-${k}`, px(v)] as [string, string]),
    ...Object.entries(iconSize).map(([k, v]) => [`--icon-${k.replace('.', '_')}`, px(v)] as [string, string]),
  ];
}

/** Semantic 글꼴 - --font-heading-1-size 등. Desktop(744 이상)은 :root, Mobile은 743px 이하 미디어 쿼리. */
export function textStyleCssEntries(mode: 'desktop' | 'mobile'): Array<[string, string]> {
  return Object.entries(textStyles[mode]).flatMap(([key, t]) => {
    const name = `--font-${kebab(key)}`;
    return [
      [`${name}-size`, px(t.fontSize)],
      [`${name}-line-height`, px(t.lineHeight)],
      [`${name}-weight`, t.fontWeight],
      [`${name}-letter-spacing`, t.letterSpacing === 0 ? '0' : `${t.letterSpacing}px`],
    ] as Array<[string, string]>;
  });
}

/**
 * 랜딩(리뉴얼 전 styles.css)과 같은 이름의 호환 별칭 - 값도 그때 랜딩 값. 앱 화면에서는 Semantic(--radius-16, --elevation-2)을 쓴다.
 * 대응표: docs/planning/디자인-시스템.md 7장.
 */
const LANDING_COMPAT: Array<[string, string]> = [
  ['--radius-sm', '14px'],
  ['--radius-md', '20px'],
  ['--radius-lg', '28px'],
  ['--shadow-card', '0 10px 28px rgba(27, 13, 51, 0.07)'],
  ['--shadow-md', '0 12px 32px rgba(27, 13, 51, 0.1)'],
  ['--shadow-lg', '0 28px 72px rgba(27, 13, 51, 0.16)'],
];

/**
 * design-tokens.css 전체 - Raw(Figma 변수 + 확장) → 크기 스케일·글꼴 → Semantic Light(:root) / Dark([data-theme="dark"]).
 * Dark 블록은 ThemeModeProvider(mode="dark")가 문서 루트에 data-theme="dark"를 붙일 때 적용된다.
 */
export function renderTokensCss(): string {
  const block = (selector: string, entries: Array<[string, string]>, indent = '') =>
    `${indent}${selector} {\n${entries.map(([n, v]) => `${indent}  ${n}: ${v};`).join('\n')}\n${indent}}\n`;
  return (
    renderDesignTokensCss() +
    '\n/* Raw 확장(Figma 미등록 - 디자인 요청 목록과 1:1) */\n' +
    block(':root', rawExtensionCssEntries()) +
    '\n/* Semantic(src/shared/ui/tokens.ts) - 화면은 이쪽만 쓴다. 값은 위 Raw 변수를 참조한다. */\n' +
    block(':root', [...scaleCssEntries(), ...textStyleCssEntries('desktop'), ...semanticCssEntries('light')]) +
    '\n' +
    `@media (max-width: ${responsive.frame.tablet - 1}px) {\n` +
    block(':root', textStyleCssEntries('mobile'), '  ') +
    '}\n' +
    '\n/* 다크(리더) - ThemeModeProvider가 <html data-theme="dark">를 붙인다. */\n' +
    block('[data-theme="dark"]', semanticCssEntries('dark')) +
    '\n/* 랜딩 호환 별칭(리뉴얼 전 랜딩 이름) */\n' +
    block(':root', LANDING_COMPAT)
  );
}
