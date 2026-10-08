/// <reference types="node" />
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * 앱이 부르는 API 경로가 모두 Vercel 프록시 허용 목록(api/_qstory-proxy-core.mjs)에 있는지 본다.
 * 빠지면 운영에서만 "요청한 API 경로가 프록시 허용 목록에 없어요"가 뜬다(원장 반 상세 최근 리포트에서 실제로 있었음).
 */
const here = fileURLToPath(new URL('.', import.meta.url));
const srcRoot = join(here, '..', '..');
const corePath = join(srcRoot, '..', 'api', '_qstory-proxy-core.mjs');
const SAMPLE_ID = '0a1b2c3d-1111-4222-8333-444455556666';
const SAMPLE_CODE = 'ABCD1234';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

test('앱이 부르는 API 경로는 모두 프록시 허용 목록에 있다', async () => {
  const { isAllowedRoute } = (await import(pathToFileURL(corePath).href)) as {
    isAllowedRoute: (method: string, path: string) => boolean;
  };
  const missing: string[] = [];
  for (const file of sourceFiles(srcRoot)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      for (const match of line.matchAll(/[`'"](\/v1\/[^`'"\s]*)[`'"]/g)) {
        // 경로 뒤 몇 줄 안의 method가 이 요청의 메서드다(requestJson 호출 모양). 없으면 GET.
        const method = lines.slice(index, index + 6).join(' ').match(/method:\s*'([A-Z]+)'/)?.[1] ?? 'GET';
        // `/v1/x${query}`처럼 경로 조각이 아닌 자리에 붙는 쿼리 문자열은 떼고, 경로 조각 자리의 `${...}`는 예시 id로 바꾼다.
        const raw = match[1].split('?')[0].replace(/(?<=[^/])\$\{[^}]*\}$/, '');
        const path = raw.replace(/\$\{[^}]*\}/g, SAMPLE_ID).replace(/^\//, '');
        const allowed = isAllowedRoute(method, path) || isAllowedRoute(method, path.replaceAll(SAMPLE_ID, SAMPLE_CODE));
        if (!allowed) missing.push(`${method} ${raw} (${relative(srcRoot, file)}:${index + 1})`);
      }
    });
  }
  assert.deepEqual(missing, []);
});
