// @ts-nocheck
/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { storybookTheme } from './theme';

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
