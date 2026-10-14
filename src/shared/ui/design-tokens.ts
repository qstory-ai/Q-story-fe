/**
 * Q-Story 디자인 시스템 원시(primitive) 토큰 - Figma 파일 "Q-story"(wIHYjX71gs80XNB1FMOaYW)의
 * 변수 34개를 그대로 옮긴 것. 단일 출처는 `design/figma-variables.json`이고, 이 파일과 그 JSON이
 * 어긋나면 `design-tokens.test.ts`가 실패한다. 웹 CSS 변수(`design-tokens.css`)는
 * `npm run tokens:generate`로 이 파일에서 만든다.
 *
 * 화면은 이 값을 직접 쓰지 않고 `theme.ts`의 의미 토큰을 쓴다 - 의미 토큰이 이 primitive를 참조한다
 * (docs/planning/디자인-시스템.md 대응표).
 *
 * 이름 규칙: Figma `Purple/500` → `primitives.purple[500]` → CSS `--purple-500`.
 * Figma에 없는 단계(Purple 600·700, Neutral 200·400)는 만들어 채우지 않는다.
 */

export const primitives = {
  base: {
    white: '#ffffff', // base/white
    ivory: '#fffdf8', // base/ivory
  },
  purple: {
    50: '#f5f1fd', // Purple/50
    100: '#eae2fa', // Purple/100
    200: '#d5c5f5', // Purple/200
    300: '#baa0ec', // Purple/300
    400: '#9979e1', // Purple/400
    500: '#7550d3', // Purple/500
    800: '#6340c0', // Purple/800
    900: '#302068', // Purple/900
  },
  neutral: {
    50: '#faf8fc', // Neutral/50
    100: '#f3f0f7', // Neutral/100
    300: '#d6cedf', // Neutral/300
    500: '#94889f', // Neutral/500
    600: '#766b80', // Neutral/600
    700: '#5a5062', // Neutral/700
    800: '#3f3846', // Neutral/800
    900: '#27222d', // Neutral/900
  },
  skyblue: {
    500: '#5eb6f6', // Skyblue/500
    700: '#2f7cb0', // Skyblue/700
  },
  pink: {
    500: '#ff6685', // Pink/500
    700: '#bc3857', // Pink/700
  },
  green: {
    500: '#7bd9a6', // Green/500
    700: '#45996c', // Green/700
  },
} as const;

/** RN fontWeight는 문자열이어야 해서 theme.ts와 같이 문자열로 둔다. */
type FontWeight = '400' | '500' | '600' | '700';

export type TypographyStyle = {
  /** Figma 텍스트 스타일 이름. */
  figmaName: string;
  fontFamily: 'Pretendard';
  /** Figma style 이름(Regular/Medium/SemiBold/Bold). */
  fontStyle: 'Regular' | 'Medium' | 'SemiBold' | 'Bold';
  fontWeight: FontWeight;
  /** px */
  fontSize: number;
  /** px로 환산한 값. Figma가 %로 준 것(Body 100%)은 fontSize × %로 바꿨다. */
  lineHeight: number;
  /**
   * Figma 자간 값(%로 해석 - Figma 자간 입력칸의 기본 단위가 %다). -1 → 글자 크기의 -1%.
   * 단위가 px였다면 값이 달라지니 디자이너 확인 필요.
   */
  letterSpacingPercent: number;
  /** px로 환산한 자간 = fontSize × letterSpacingPercent / 100. */
  letterSpacing: number;
};

function textStyle(
  figmaName: string,
  fontStyle: TypographyStyle['fontStyle'],
  fontWeight: FontWeight,
  fontSize: number,
  lineHeight: number,
  letterSpacingPercent: number,
): TypographyStyle {
  return {
    figmaName,
    fontFamily: 'Pretendard',
    fontStyle,
    fontWeight,
    fontSize,
    lineHeight,
    letterSpacingPercent,
    letterSpacing: Math.round(fontSize * letterSpacingPercent) / 100,
  };
}

export const typography = {
  display: textStyle('Display', 'Bold', '700', 48, 60, -1), // Display
  heading1: textStyle('Heading 1', 'Bold', '700', 36, 46, -1), // Heading 1
  heading2: textStyle('Heading 2', 'Bold', '700', 30, 40, -1), // Heading 2
  heading3: textStyle('Heading 3', 'SemiBold', '600', 24, 34, 0), // Heading 3
  heading4: textStyle('Heading 4', 'Medium', '500', 24, 30, 0), // Heading 4
  bodyLarge: textStyle('Body Large', 'Medium', '500', 18, 24, 0), // Body Large
  // Figma lineHeight 100 - 다른 스타일과 달리 % 단위(100% = 16px)로 해석했다. 디자이너 확인 필요.
  body: textStyle('Body', 'Regular', '400', 16, 16, 0), // Body
  bodySmall: textStyle('Body Small', 'Regular', '400', 14, 20, 0), // Body Small
} as const;

/** 선 두께(px). Figma가 float32로 준 1.7999999523162842를 1.8로 반올림. */
export const strokeWeight = {
  '1_8': 1.8, // stroke weight/1_8
} as const;

/** 불투명도(0~1). Figma는 0~100으로 준다. */
export const opacity = {
  100: 1, // opacity/100
} as const;

export const designTokens = { primitives, typography, strokeWeight, opacity } as const;

/**
 * Figma 변수 이름 → 이 파일의 값. 테스트가 `design/figma-variables.json`과 1:1로 맞춰 본다.
 * 글꼴 스타일은 Figma 표기("Font(family: ...)")를 다시 만들어 비교한다.
 */
export function figmaVariableEntries(): Array<[string, string]> {
  const entries: Array<[string, string]> = [
    ['base/white', primitives.base.white],
    ['base/ivory', primitives.base.ivory],
  ];
  const scales = [
    ['Purple', primitives.purple],
    ['Neutral', primitives.neutral],
    ['Skyblue', primitives.skyblue],
    ['Pink', primitives.pink],
    ['Green', primitives.green],
  ] as const;
  for (const [figmaGroup, scale] of scales) {
    for (const [step, hex] of Object.entries(scale)) entries.push([`${figmaGroup}/${step}`, hex]);
  }
  for (const style of Object.values(typography)) {
    const figmaLineHeight = style.figmaName === 'Body' ? 100 : style.lineHeight;
    entries.push([
      style.figmaName,
      `Font(family: "${style.fontFamily}", style: ${style.fontStyle}, size: ${style.fontSize}, ` +
        `weight: ${style.fontWeight}, lineHeight: ${figmaLineHeight}, letterSpacing: ${style.letterSpacingPercent})`,
    ]);
  }
  entries.push(['stroke weight/1_8', String(strokeWeight['1_8'])]);
  entries.push(['opacity/100', String(opacity[100] * 100)]);
  return entries;
}

/** 본문 행간(px) - Figma 값(100% = 16px) 대신 쓰는 가정값. */
export const BODY_LINE_HEIGHT = 24;

const kebab = (s: string) => s.replace(/([a-z])([A-Z0-9])/g, '$1-$2').toLowerCase();

/** CSS 변수 이름 규칙 - 랜딩(q-story-landing src/styles.css)과 같게: --purple-500, --sky-500, --ivory. */
export function cssVariableEntries(): Array<[string, string]> {
  const entries: Array<[string, string]> = [
    ['--white', primitives.base.white],
    ['--ivory', primitives.base.ivory],
  ];
  const scales = [
    ['purple', primitives.purple],
    ['neutral', primitives.neutral],
    ['sky', primitives.skyblue],
    ['pink', primitives.pink],
    ['green', primitives.green],
  ] as const;
  for (const [prefix, scale] of scales) {
    for (const [step, hex] of Object.entries(scale)) entries.push([`--${prefix}-${step}`, hex]);
  }
  for (const [key, s] of Object.entries(typography)) {
    const name = `--text-${kebab(key)}`;
    // Body 행간은 Figma 100(=16px)이 한글 본문에 빽빽해 24px로 쓴다(tokens.ts textStyles와 같음 - 디자이너 확인 요청 중).
    const lineHeight = key === 'body' ? BODY_LINE_HEIGHT : s.lineHeight;
    entries.push([`${name}-size`, `${s.fontSize}px`]);
    entries.push([`${name}-weight`, s.fontWeight]);
    entries.push([`${name}-line-height`, `${lineHeight}px`]);
    entries.push([`${name}-letter-spacing`, s.letterSpacing === 0 ? '0' : `${s.letterSpacing}px`]);
  }
  entries.push(['--stroke-weight-1-8', `${strokeWeight['1_8']}px`]);
  entries.push(['--opacity-100', String(opacity[100])]);
  return entries;
}

export function renderDesignTokensCss(): string {
  const lines = cssVariableEntries().map(([name, value]) => `  ${name}: ${value};`);
  return (
    '/* 자동 생성 파일 - 직접 고치지 말 것. design/figma-variables.json → src/shared/ui/design-tokens.ts →\n' +
    '   npm run tokens:generate. src/app/global.css가 불러온다. */\n' +
    ':root {\n' +
    lines.join('\n') +
    '\n}\n'
  );
}
