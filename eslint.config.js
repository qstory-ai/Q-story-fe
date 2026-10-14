import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';


/**
 * FSD 레이어 경계(app > pages > widgets > features > entities > shared). 아래 레이어는 위 레이어를 import하지 않고,
 * 다른 slice는 공개 API(index.ts)로만 쓴다(@/entities/x/model/... 같은 깊은 경로 금지). pages끼리는 서로 import하지 않는다 -
 * 같이 쓰는 UI는 widgets로. 운영 코드는 테스트 픽스처(@/test-fixtures)를 쓰지 않는다.
 */
const LAYERS = ['app', 'pages', 'widgets', 'features', 'entities', 'shared'];
const DEEP_PATHS = {
  group: ['@/app/*', '@/pages/*/**', '@/widgets/*/**', '@/features/*/**', '@/entities/*/**', '@/shared/*/**', '../../../*'],
  message: '다른 slice는 공개 API(@/<layer>/<slice>)로만 import한다. 상대 경로는 slice 밖으로 나가지 않는다.',
};
function boundaryRule(layer, { tests = false } = {}) {
  const above = LAYERS.slice(0, LAYERS.indexOf(layer));
  const patterns = [DEEP_PATHS];
  if (above.length > 0) {
    patterns.push({
      group: above.flatMap((name) => [`@/${name}`, `@/${name}/*`]),
      message: `${layer} 레이어는 위 레이어(${above.join(', ')})를 import하지 않는다.`,
    });
  }
  if (layer === 'pages') {
    patterns.push({ group: ['@/pages/*'], message: '페이지끼리는 import하지 않는다 - 같이 쓰는 UI는 widgets로 옮긴다.' });
  }
  if (!tests) {
    patterns.push({ group: ['@/test-fixtures', '@/test-fixtures/**'], message: '테스트 픽스처는 테스트에서만 쓴다.' });
  }
  return { 'no-restricted-imports': ['error', { patterns }] };
}

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'content/stories/*/generated/*.json'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['scripts/**/*.mjs', 'api/**/*.mjs', 'container-server.mjs', 'vite.config.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },
  {
    // AudioWorklet 스코프 파일 - AudioWorkletProcessor·sampleRate·registerProcessor가 전역이다.
    files: ['public/audio/*-worklet.js'],
    languageOptions: { globals: globals.audioWorklet },
  },
  ...LAYERS.map((layer) => ({ files: [`src/${layer}/**/*.{ts,tsx}`], rules: boundaryRule(layer) })),
  ...LAYERS.map((layer) => ({ files: [`src/${layer}/**/*.test.ts`], rules: boundaryRule(layer, { tests: true }) })),
  {
    // Node-test-runner files use `@ts-nocheck` deliberately (Node test-runner types are kept out
    // of the browser type-check), plus one legitimate `this`-binding test.
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-this-alias': 'off',
    },
  },
);
