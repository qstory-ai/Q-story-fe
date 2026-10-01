/// <reference types="node" />
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';

import { BANNED_UI_TERMS, BETA_OPEN_ACCESS_NOTICE, subscriptionStatusLabel } from './glossary';

test('이용권 상태 라벨은 한 벌이다', () => {
  assert.equal(subscriptionStatusLabel('NONE'), '이용권 없음');
  assert.equal(subscriptionStatusLabel('TRIALING'), '체험 중');
  assert.equal(subscriptionStatusLabel('ACTIVE'), '이용 중');
  assert.equal(subscriptionStatusLabel('EXPIRED'), '만료됨');
});

test('베타 개방 안내 문구', () => {
  assert.equal(BETA_OPEN_ACCESS_NOTICE, '베타 기간에는 모든 이야기가 열려 있어요.');
});

const SRC_ROOT = join(import.meta.dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name) && !path.endsWith('glossary.ts') ? [path] : [];
  });
}

/** 블록 주석·줄 주석을 지운다(URL의 "://"는 남긴다). 줄 수는 유지한다. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, '')).replace(/(^|[^:])\/\/.*$/gm, '$1');
}

test('화면 문구에 금지어가 없다', () => {
  const hits: string[] = [];
  for (const file of sourceFiles(SRC_ROOT)) {
    const code = stripComments(readFileSync(file, 'utf8'));
    code.split('\n').forEach((line, index) => {
      for (const term of BANNED_UI_TERMS) {
        if (line.includes(term)) hits.push(`${relative(SRC_ROOT, file)}:${index + 1} "${term}"`);
      }
    });
  }
  assert.deepEqual(hits, []);
});
