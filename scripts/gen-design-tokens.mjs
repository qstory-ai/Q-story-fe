// design-tokens.ts(→ Figma 변수 사본 design/figma-variables.json과 테스트로 묶여 있음)에서
// 웹 CSS 변수 파일을 만든다. 실행: npm run tokens:generate  /  확인만: npm run tokens:check
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { renderDesignTokensCss } from '../src/shared/ui/design-tokens.ts';

const outPath = fileURLToPath(new URL('../src/shared/ui/design-tokens.css', import.meta.url));
const next = renderDesignTokensCss();

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(outPath, 'utf8');
  } catch {
    // 파일이 없으면 아래에서 실패 처리
  }
  if (current !== next) {
    console.error('design-tokens.css가 design-tokens.ts와 다릅니다. npm run tokens:generate 를 실행하세요.');
    process.exit(1);
  }
  console.log('design-tokens.css 최신 상태');
} else {
  writeFileSync(outPath, next);
  console.log(`썼음: ${outPath}`);
}
