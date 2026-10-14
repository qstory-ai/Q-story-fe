// @ts-nocheck
/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { figmaVariableEntries, renderDesignTokensCss } from './design-tokens';
import { storybookTheme } from './theme';

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
  assert.equal(css.replace(/\r\n/g, '\n'), renderDesignTokensCss());
});

test('CSS 변수 이름이 랜딩 규칙(--purple-500, --sky-500, --ivory)을 따른다', () => {
  const css = renderDesignTokensCss();
  for (const line of ['--purple-500: #7550d3;', '--neutral-900: #27222d;', '--sky-700: #2f7cb0;', '--ivory: #fffdf8;']) {
    assert.ok(css.includes(line), line);
  }
});

test('이번 단계는 앱 테마 값을 바꾸지 않는다(navy·gold 그대로)', () => {
  assert.equal(storybookTheme.color.primary, '#1E293B');
  assert.equal(storybookTheme.color.background, '#F7F8FA');
  assert.equal(storybookTheme.color.gold, '#F6C64D');
  assert.equal(storybookTheme.color.linkOnLight, '#2451B2');
  assert.equal(storybookTheme.color.error, '#C24A2E');
});
