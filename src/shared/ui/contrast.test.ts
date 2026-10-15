// @ts-nocheck
/// <reference types="node" />
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { storybookTheme } from './theme';
import { semanticColors } from './tokens';

type Rgb = [number, number, number];

/** '#rrggbb' 또는 'rgba(r, g, b, a)'를 읽는다. 반투명이면 under(기본 흰색) 위에 얹은 색으로 계산한다. */
function resolve(color: string, under: Rgb = [255, 255, 255]): Rgb {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (hex) {
    const v = hex[1];
    return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)) as Rgb;
  }
  const rgba = /^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)$/.exec(color);
  if (!rgba) throw new Error(`읽을 수 없는 색: ${color}`);
  const a = rgba[4] === undefined ? 1 : Number(rgba[4]);
  return [1, 2, 3].map((i, k) => Math.round(Number(rgba[i]) * a + under[k] * (1 - a))) as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(fg: Rgb, bg: Rgb): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const { color: c, semantic: s, status } = storybookTheme;
const READER_DARK: Rgb = [0x12, 0x09, 0x1f];
const WHITE: Rgb = [255, 255, 255];
/** 반투명 바탕을 가장 밝은 장면(흰색) 위에 얹은 최악값. */
const ON_BRIGHT_SCENE = WHITE;

/**
 * [이름, 글자, 바탕, 바탕 아래(반투명 바탕일 때), 기준]. 기준 4.5 = WCAG AA 본문. 3.0은 큰 글자(18pt+ 또는 14pt bold+)·
 * 아이콘·채움 마커·비활성 표시에만 쓰고 이유를 이름에 적는다.
 */
const PAIRS: Array<[string, string, string, Rgb | undefined, number]> = [
  ['primary 버튼 글자', s.brand.onBrand, s.brand.default, undefined, 4.5],
  ['primary hover 글자', s.brand.onBrand, s.brand.hover, undefined, 4.5],
  ['강조 채움 위 글자', c.onAccentFill, c.accentFill, undefined, 4.5],
  ['강조 채움 hover 위 글자', c.onAccentFill, c.accentFillHover, undefined, 4.5],
  ['gold 버튼 글자', s.accent.onAccent, s.accent.default, undefined, 4.5],
  ['페이지 제목', c.onContent, c.background, undefined, 4.5],
  ['페이지 흐린 글자', c.onContentMuted, c.background, undefined, 4.5],
  ['패널 위 흐린 글자', c.onContentMuted, c.contentPanel, undefined, 4.5],
  ['카드 제목', c.onCardTitle, c.surfaceCard, undefined, 4.5],
  ['카드 본문', c.onCardBody, c.surfaceCard, undefined, 4.5],
  ['카드 흐린 글자', c.onCardMuted, c.surfaceCard, undefined, 4.5],
  ['셸 제목', c.onLightHeading, c.shellBackground, undefined, 4.5],
  ['셸 본문', c.onLightBody, c.shellBackground, undefined, 4.5],
  ['셸 흐린 글자', c.onLightMuted, c.shellBackground, undefined, 4.5],
  ['pill 글자(라이트)', c.onCardBody, c.pillBackground, undefined, 4.5],
  ['밝은 바탕 링크', c.linkOnLight, c.surfaceCard, undefined, 4.5],
  ['페이지 위 링크', c.linkOnLight, c.background, undefined, 4.5],
  ['사이드바 글자', c.onDark, c.sidebarBackground, undefined, 4.5],
  ['사이드바 링크', c.linkOnDark, c.sidebarBackground, undefined, 4.5],
  ['사이드바 활성 아이콘(아이콘 3.0)', c.gold, c.sidebarBackground, undefined, 3],
  ['오류 글자', c.error, c.surfaceCard, undefined, 4.5],
  ['경고 배너 글자', status.warning.text, status.warning.background, undefined, 4.5],
  ['위험 배지 글자', s.danger.text, s.danger.background, undefined, 4.5],
  ['성공 배너 글자', s.positive.text, s.positive.background, undefined, 4.5],
  ['정보 배너 본문', c.onLightBody, status.info.background, undefined, 4.5],
  ['정보 글자(흰 바탕)', status.info.text, c.surfaceCard, undefined, 4.5],
  ['보라 강조 글자', c.goldText, c.surfaceCard, undefined, 4.5],
  ['옅은 보라 바탕 위 강조 글자', c.goldText, s.brand.secondary, undefined, 4.5],
  ['accentSoft 위 강조 글자', c.goldText, c.accentSoft, undefined, 4.5],
  ['secondary 버튼 글자', c.primary, c.pillBackground, undefined, 4.5],
  ['어두운 바탕 강조 글자(리더)', c.accentOnDark, c.readerControlBackground, READER_DARK, 4.5],
  ['어두운 바탕 강조 글자(사이드바)', c.accentOnDark, c.sidebarBackground, undefined, 4.5],
  ['리더 제목(ivory 카드)', c.readerHeading, c.storybookCard, undefined, 4.5],
  ['리더 제목(ivory 카드를 어두운 리더 위에)', c.readerHeading, c.storybookCard, READER_DARK, 4.5],
  ['리더 버튼 아이콘·글자(밝은 장면 위 반투명 버튼)', c.accentOnDark, c.readerControlBackground, ON_BRIGHT_SCENE, 4.5],
  ['리더 버튼 흰 글자(밝은 장면 위)', c.onDark, c.readerControlBackground, ON_BRIGHT_SCENE, 4.5],
  ['삽화 막 위 흰 글자(밝은 장면)', c.onDark, c.imageScrim, ON_BRIGHT_SCENE, 4.5],
  ['삽화 진한 막 위 강조 글자(밝은 장면)', c.accentOnDark, c.imageScrimStrong, ON_BRIGHT_SCENE, 4.5],
  ['리더 대화 패널 글자', c.onDark, c.readerPanelBackground, ON_BRIGHT_SCENE, 4.5],
  ['리더 대화 패널 오류 글자', c.errorOnDark, c.readerPanelBackground, ON_BRIGHT_SCENE, 4.5],
  ['랜딩(밝은 바탕) 강조 글자', c.goldText, c.background, undefined, 4.5],
  ['리포트 카드 흐린 글자', c.readerBodyMuted, c.readerCard, undefined, 4.5],
  ['리포트 카드 본문', c.readerBodyStrong, c.readerCard, undefined, 4.5],
  ['캘린더 일요일(흰 카드)', c.calendarSunday, c.surfaceCard, undefined, 4.5],
  ['캘린더 토요일(흰 카드)', c.calendarSaturday, c.surfaceCard, undefined, 4.5],
  ['밝은 바탕 오류 글자(리포트 카드)', c.error, c.readerCard, undefined, 4.5],
  ['성공 글자(흰 바탕)', s.positive.text, c.surfaceCard, undefined, 4.5],
  ['강조 마커(흰 바탕, 채움 3.0)', c.gold, c.surfaceCard, undefined, 3],
  ['비활성 버튼 라벨', c.disabledText, c.disabledBackground, undefined, 4.5],
  ['보조 흐린 표시(예외 3.0, 본문 아님)', c.onContentSubtle, c.background, undefined, 3],
];

test('의미 토큰 글자/바탕 짝은 WCAG 대비 기준을 넘는다', () => {
  const failures = [];
  for (const [name, fg, bg, under, min] of PAIRS) {
    const bgRgb = resolve(bg, under);
    const ratio = contrast(resolve(fg, bgRgb), bgRgb);
    if (ratio < min) failures.push(`${name}: ${ratio.toFixed(2)} < ${min} (${fg} on ${bg})`);
  }
  assert.deepEqual(failures, []);
});


// ── Semantic(tokens.ts) 짝: Light·Dark 모드 각각 ─────────────────────────────────────────────────
/**
 * [이름, 글자(또는 아이콘·테두리), 바탕, 기준]. 반투명 바탕은 그 모드의 bg.primary 위에 얹어 계산한다.
 * 글자 4.5, 아이콘·입력 테두리·포커스 링·큰 글자 3.0(WCAG 1.4.11).
 */
function semanticPairs(mode: 'light' | 'dark'): Array<[string, string, string, number]> {
  const { text: t, bg, border: b, icon: i } = semanticColors[mode];
  const pairs: Array<[string, string, string, number]> = [];
  const add = (name: string, fg: string, bgs: Record<string, string>, min: number) => {
    for (const [bgName, bgValue] of Object.entries(bgs)) pairs.push([`${name} on ${bgName}`, fg, bgValue, min]);
  };
  const surfaces = { 'bg.primary': bg.primary, 'bg.secondary': bg.secondary };
  const allSurfaces = { ...surfaces, 'bg.tertiary': bg.tertiary, 'bg.brandSubtle': bg.brandSubtle };
  add('text.primary', t.primary, { ...allSurfaces, 'bg.disabled': bg.disabled }, 4.5);
  add('text.secondary', t.secondary, { ...allSurfaces, 'bg.infoSubtle': bg.infoSubtle, 'bg.successSubtle': bg.successSubtle, 'bg.errorSubtle': bg.errorSubtle }, 4.5);
  add('text.tertiary', t.tertiary, mode === 'light' ? { ...surfaces, 'bg.brandSubtle': bg.brandSubtle } : allSurfaces, 4.5);
  add('text.disabled', t.disabled, { 'bg.disabled': bg.disabled, 'bg.primary': bg.primary }, 4.5);
  add('text.link', t.link, surfaces, 4.5);
  add('text.info', t.info, mode === 'light' ? { 'bg.primary': bg.primary } : surfaces, 4.5);
  add('text.success', t.success, { ...surfaces, 'bg.successSubtle': bg.successSubtle }, 4.5);
  add('text.warning', t.warning, mode === 'light' ? { ...surfaces, 'bg.warningSubtle': bg.warningSubtle } : surfaces, 4.5);
  add('text.primary(경고 채움 위)', t.primary, mode === 'light' ? { 'bg.warning': bg.warning, 'bg.warningSubtle': bg.warningSubtle } : { 'bg.warningSubtle': bg.warningSubtle }, 4.5);
  add('text.interactive.inverse(다크 경고 채움 위)', semanticColors.dark.text.interactive.inverse, mode === 'dark' ? { 'bg.warning': bg.warning } : {}, 4.5);
  // 다크 오류 배너 안 글자는 text.primary(흰) - Pink 500 글자는 옅은 분홍 막 위에서 4.5에 못 미친다.
  add('text.error', t.error, mode === 'light' ? { ...surfaces, 'bg.errorSubtle': bg.errorSubtle } : surfaces, 4.5);
  add('text.primary', t.primary, { 'bg.errorSubtle': bg.errorSubtle, 'bg.infoSubtle': bg.infoSubtle, 'bg.successSubtle': bg.successSubtle }, 4.5);
  add('icon.error(배너 안)', i.error, { 'bg.errorSubtle': bg.errorSubtle }, 3);
  for (const state of ['default', 'hover', 'pressed'] as const) {
    add(`text.interactive.primary.${state}`, t.interactive.primary[state], surfaces, 4.5);
    add(`text.interactive.secondary.${state}`, t.interactive.secondary[state], surfaces, 4.5);
    add('text.interactive.inverse', t.interactive.inverse, {
      [`bg.interactive.primary.${state}`]: bg.interactive.primary[state],
      [`bg.interactive.error.${state}`]: bg.interactive.error[state],
    }, 4.5);
    add('text.interactive.selected', t.interactive.selected, {
      [`bg.interactive.secondary.${state}`]: bg.interactive.secondary[state],
      [`bg.interactive.selected.${state}`]: bg.interactive.selected[state],
    }, 4.5);
    add(`border.interactive.primary.${state}`, b.interactive.primary[state], surfaces, 3);
    add(`border.interactive.neutral.${state}`, b.interactive.neutral[state], surfaces, 3);
    add(`icon.interactive.primary.${state}`, i.interactive.primary[state], surfaces, 3);
    add(`icon.interactive.secondary.${state}`, i.interactive.secondary[state], surfaces, 3);
    add('icon.interactive.inverse', i.interactive.inverse, { [`bg.interactive.primary.${state}`]: bg.interactive.primary[state] }, 3);
  }
  add('text.interactive.inverse', t.interactive.inverse, {
    'bg.brand': bg.brand, 'bg.info': bg.info, 'bg.infoBold': bg.infoBold, 'bg.successBold': bg.successBold,
    'bg.error': bg.error, 'bg.errorBold': bg.errorBold,
  }, 4.5);
  add('icon.interactive.inverse(채움 위 아이콘)', i.interactive.inverse, { 'bg.success': bg.success }, 3);
  add('text.inverse', t.inverse, { 'bg.inverse': bg.inverse }, 4.5);
  add('text.onWarm', t.onWarm, { 'bg.warm': bg.warm }, 4.5);
  add('bg.indicator(글자 없는 채움 3.0)', bg.indicator, surfaces, 3);
  add('bg.recording(글자 없는 채움 3.0)', bg.recording, surfaces, 3);
  add('border.primary(입력 경계)', b.primary, surfaces, 3);
  add('border.focus', b.focus, surfaces, 3);
  add('border.error', b.error, surfaces, 3);
  add('border.warning', b.warning, surfaces, 3);
  for (const key of ['primary', 'secondary', 'brand', 'disabled', 'info', 'success', 'warning', 'error'] as const) {
    add(`icon.${key}`, i[key], surfaces, 3);
  }
  return pairs;
}

/** 모드별 불투명 표면 - 반투명 바탕은 이 표면 모두 위에 얹어 각각 검사한다(가장 나쁜 경우가 기준). */
function opaqueSurfaces(mode: 'light' | 'dark'): Record<string, string> {
  const { bg } = semanticColors[mode];
  return mode === 'light'
    ? { 'bg.primary': bg.primary, 'bg.secondary': bg.secondary, 'bg.tertiary': bg.tertiary, 'bg.warm': bg.warm }
    : { 'bg.primary': bg.primary, 'bg.secondary': bg.secondary, 'bg.tertiary': bg.tertiary };
}

for (const mode of ['light', 'dark'] as const) {
  test(`Semantic ${mode} 짝은 글자 4.5:1 · 아이콘/경계 3:1을 넘는다(반투명 바탕은 모든 불투명 표면 위에서)`, () => {
    const failures = [];
    for (const [name, fg, bg, min] of semanticPairs(mode)) {
      const unders = bg.startsWith('rgba') ? Object.entries(opaqueSurfaces(mode)) : [['', bg] as [string, string]];
      for (const [underName, underValue] of unders) {
        const bgRgb = resolve(bg, resolve(underValue));
        const ratio = contrast(resolve(fg, bgRgb), bgRgb);
        if (ratio < min) failures.push(`${name}${underName ? ` (over ${underName})` : ''}: ${ratio.toFixed(2)} < ${min} (${fg} on ${bg})`);
      }
    }
    assert.deepEqual(failures, []);
  });
}

// ── 소스 스캔: 한 스타일 객체 안에 글자색과 바탕색이 함께 있으면 그 짝을 계산한다 ─────────────────
function tokenValue(expr: string): string | undefined {
  const parts = expr.replace(/^storybookTheme\./, '').split('.');
  let node: unknown = storybookTheme;
  for (const part of parts) node = (node as Record<string, unknown> | undefined)?.[part];
  return typeof node === 'string' ? node : undefined;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

/**
 * 글자 토큰별로 같은 스타일 객체 바탕으로 쓰면 안 되는 바탕. accentOnDark·errorOnDark는 어두운 바탕 전용이다.
 * (바탕이 부모 View에 있는 경우는 잡지 못한다 - 위 PAIRS가 그 짝을 따로 본다.)
 */
const DARK_ONLY = new Set(['color.accentOnDark', 'color.errorOnDark', 'color.linkOnDark']);

test('스타일 객체 안 글자/바탕 짝은 4.5:1 이상, 어두운 바탕 전용 글자는 밝은 바탕에 쓰지 않는다', () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const failures: string[] = [];
  for (const file of sourceFiles(root)) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/(\w+): \{([^{}]*)\}/g)) {
      const body = match[2];
      const fg = /(?:^|[\s,{])color: (storybookTheme\.[\w.]+)/.exec(body)?.[1];
      const bg = /backgroundColor: (storybookTheme\.[\w.]+)/.exec(body)?.[1];
      if (!fg || !bg) continue;
      const fgValue = tokenValue(fg);
      const bgValue = tokenValue(bg);
      if (!fgValue || !bgValue) continue;
      // 반투명 바탕은 놓이는 곳 기준으로 합성한다 - 어두운 막(onDark*·scrim·리더 버튼/패널)은 어두운 리더 위, 나머지는 흰 바탕 위.
      const overDark = /onDark|Scrim|readerControl|readerPanel/.test(bg);
      const bgRgb = resolve(bgValue, overDark ? READER_DARK : WHITE);
      const ratio = contrast(resolve(fgValue, bgRgb), bgRgb);
      const where = `${file.slice(root.length)} ${match[1]}`;
      if (ratio < 4.5) failures.push(`${where}: ${fg} on ${bg} = ${ratio.toFixed(2)}`);
      const fgKey = fg.replace('storybookTheme.', '');
      if (DARK_ONLY.has(fgKey) && luminance(resolve(bgValue)) > 0.4) failures.push(`${where}: ${fgKey}는 어두운 바탕 전용`);
    }
  }
  assert.deepEqual(failures, []);
});
