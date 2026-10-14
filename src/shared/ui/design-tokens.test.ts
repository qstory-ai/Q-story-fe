// @ts-nocheck
/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { figmaVariableEntries, primitives, renderDesignTokensCss } from './design-tokens';
import { storybookTheme } from './theme';
import { renderTokensCss, semanticColors } from './tokens';

const figma = JSON.parse(
  readFileSync(new URL('../../../design/figma-variables.json', import.meta.url), 'utf8'),
).variables as Record<string, string>;

const sameValue = (a: string, b: string) => {
  const na = Number(a);
  const nb = Number(b);
  if (a.trim() !== '' && b.trim() !== '' && Number.isFinite(na) && Number.isFinite(nb)) {
    return Math.abs(na - nb) < 1e-6; // stroke weight 1.7999999523162842 ≈ 1.8
  }
  return a.toLowerCase() === b.toLowerCase();
};

test('Figma 변수 34개가 design-tokens.ts에 빠짐없이 같은 값으로 있다', () => {
  const ours = new Map(figmaVariableEntries());
  assert.equal(Object.keys(figma).length, 34);
  assert.deepEqual([...ours.keys()].sort(), Object.keys(figma).sort());
  for (const [name, value] of Object.entries(figma)) {
    assert.ok(sameValue(ours.get(name), value), `${name}: 코드 ${ours.get(name)} ≠ Figma ${value}`);
  }
});

test('커밋된 design-tokens.css가 생성 결과와 같다(npm run tokens:generate)', () => {
  const css = readFileSync(new URL('./design-tokens.css', import.meta.url), 'utf8');
  assert.equal(css.replace(/\r\n/g, '\n'), renderTokensCss());
});

test('CSS 변수 이름이 랜딩 규칙(--purple-500, --sky-500, --ivory)을 따른다', () => {
  const css = renderDesignTokensCss();
  for (const line of ['--purple-500: #7550d3;', '--neutral-900: #27222d;', '--sky-700: #2f7cb0;', '--ivory: #fffdf8;']) {
    assert.ok(css.includes(line), line);
  }
});

test('앱 의미 토큰은 CTO 대응표대로 primitive를 가리킨다(docs/planning/디자인-시스템.md 6장)', () => {
  const { color, semantic } = storybookTheme;
  assert.equal(color.primary, primitives.purple[500]);
  assert.equal(semantic.brand.default, primitives.purple[500]);
  assert.equal(semantic.brand.hover, primitives.purple[800]);
  assert.equal(color.linkOnLight, primitives.purple[800]);
  assert.equal(color.linkOnDark, primitives.purple[200]);
  assert.equal(color.sidebarBackground, primitives.purple[900]);
  assert.equal(color.background, primitives.neutral[50]);
  assert.equal(color.onLightHeading, primitives.neutral[900]);
  assert.equal(color.onLightBody, primitives.neutral[700]);
  assert.equal(color.onLightMuted, primitives.neutral[600]);
  assert.equal(color.lightCardBorder, primitives.neutral[300]);
  assert.equal(color.error, primitives.pink[700]);
  // 골드는 쓰지 않는다 - 채움·마커는 Purple 400, 글자는 Purple 800.
  assert.equal(color.gold, primitives.purple[400]);
  assert.equal(color.goldText, primitives.purple[800]);
});

test('Semantic CSS 변수가 hanbit 이름 규칙(--color-bg-interactive-primary)과 다크 모드 블록을 갖는다', () => {
  const css = renderTokensCss();
  for (const line of [
    '--color-bg-interactive-primary: #7550d3;',
    '--color-bg-interactive-primary-hover: #6340c0;',
    '--color-text-interactive-inverse: #ffffff;',
    '--space-16: 16px;',
    '--radius-rounded: 9999px;',
  ]) {
    assert.ok(css.includes(line), line);
  }
  assert.ok(css.includes('[data-theme="dark"] {'));
});

test('theme.ts 별칭은 tokens.ts Semantic과 같은 값을 가리킨다(점진 이전 중 호환)', () => {
  const { color, semantic, status } = storybookTheme;
  const L = semanticColors.light;
  const D = semanticColors.dark;
  assert.equal(color.background, L.bg.secondary);
  assert.equal(color.surfaceCard, L.bg.primary);
  assert.equal(color.onCardTitle, L.text.primary);
  assert.equal(color.onCardBody, L.text.secondary);
  assert.equal(color.onCardMuted, L.text.tertiary);
  assert.equal(color.primary, L.bg.interactive.primary.default);
  assert.equal(semantic.brand.hover, L.bg.interactive.primary.hover);
  assert.equal(color.disabledText, L.text.disabled);
  assert.equal(semantic.danger.background, L.bg.errorSubtle);
  assert.equal(status.info.background, L.bg.infoSubtle);
  assert.equal(color.accentOnDark, D.text.interactive.primary.default);
  assert.equal(color.sidebarBackground, D.bg.secondary);
});
