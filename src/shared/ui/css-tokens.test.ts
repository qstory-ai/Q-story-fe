// @ts-nocheck
/// <reference types="node" />
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { cssVariableEntries } from './design-tokens';
import { rawExtensionCssEntries } from './tokens';

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return cssFiles(path);
    return name.endsWith('.css') ? [path] : [];
  });
}

test('shared/ui 밖 CSS는 Raw 변수(--purple-500 등)를 직접 쓰지 않는다 - Semantic --color-* 를 쓴다', () => {
  const src = fileURLToPath(new URL('../../', import.meta.url));
  const uiDir = fileURLToPath(new URL('./', import.meta.url));
  const raw = new Set([...cssVariableEntries(), ...rawExtensionCssEntries()].map(([name]) => name));
  const failures: string[] = [];
  for (const file of cssFiles(src)) {
    if (file.startsWith(uiDir)) continue;
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/var\((--[\w-]+)/g)) {
      if (raw.has(match[1])) failures.push(`${file.slice(src.length)}: ${match[1]}`);
    }
  }
  assert.deepEqual(failures, []);
});
