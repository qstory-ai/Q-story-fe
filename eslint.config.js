import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import importX from 'eslint-plugin-import-x';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));


/**
 * FSD 레이어 경계(app > pages > widgets > features > entities > shared)를 import-x/no-restricted-paths로 막는다.
 * 경로는 resolver로 실제 파일까지 풀어서 보므로 alias(@/...)·상대 경로·동적 import()·require가 모두 같은 규칙을 받는다.
 * - 아래 레이어는 위 레이어를 import하지 않는다.
 * - 다른 slice는 공개 API(index.ts)로만 쓴다. 같은 레이어의 다른 slice는 SAME_LAYER_ALLOWED에 적은 것만(그것도 index로).
 * - slice 안에서 자기 배럴(@/<layer>/<slice> = 자기 index.ts)을 import하지 않는다(자기 순환).
 * - src/test-fixtures도 운영 레이어를 공개 API로만 쓴다. 운영 코드는 테스트 픽스처를 쓰지 않는다(no-restricted-imports).
 */
const LAYERS = ['app', 'pages', 'widgets', 'features', 'entities', 'shared'];
const SRC = path.join(dirname, 'src');
/** 같은 레이어 다른 slice 의존 중 허용하는 것(공개 API로만). shared의 segment끼리는 모두 허용. */
const SAME_LAYER_ALLOWED = {
  // ── entities: 도메인끼리 겹치는 의존. 새 의존은 여기에 이유와 함께 더한다 ──
  'entities/analytics': ['entities/story-runtime', 'entities/report'], // 이벤트·이탈 진단이 진행 상태·질문 결과 타입을 쓴다
  'entities/auth': ['entities/analytics'], // 로그인·로그아웃 때 통계 토큰·이어 읽기 기록 정리
  'entities/bookmark': ['entities/auth'], // 로그인 사용자별 저장
  'entities/child': ['entities/analytics', 'entities/auth'], // 아이 목록은 로그인 사용자 기준, 옛 진행 기록 이전
  'entities/class-lifecycle': ['entities/auth'],
  'entities/companion-chat': ['entities/speech-pipeline'], // 동반자 대화가 음성 파이프라인 주소를 쓴다
  'entities/homeroom-invite': ['entities/auth'],
  'entities/lesson': ['entities/story-completion'],
  'entities/live-branch': ['entities/speech-pipeline'],
  'entities/organization-tutor': ['entities/lesson', 'entities/tutor'],
  'entities/report': ['entities/story', 'entities/story-runtime'], // 리포트는 이야기 패키지·런타임 상태로 계산한다
  'entities/session-recording': ['entities/analytics'], // 통계 세션 id·상호작용 추적을 함께 쓴다
  'entities/speech-pipeline': ['entities/story', 'entities/story-runtime'],
  'entities/story': ['entities/auth', 'entities/story-runtime'],
  'entities/story-completion': ['entities/play-session', 'entities/report'],
  'entities/tutor': ['entities/story-completion'],
  // ── features: 화면 흐름을 조립하는 feature가 작은 feature를 쓴다 ──
  'features/onboarding': ['features/institution-search', 'features/oauth-login', 'features/terms-consent'],
  'features/reconsent': ['features/terms-consent'],
  'features/lesson-form': ['features/tutor-class-picker'],
  'features/class-lesson-start': ['features/story-library'],
};

function slicesOf(layer) {
  const dir = path.join(SRC, layer);
  if (layer === 'app') return [{ layer, name: '', dir }];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ layer, name: entry.name, dir: path.join(dir, entry.name) }));
}
const SLICES = Object.fromEntries(LAYERS.map((layer) => [layer, slicesOf(layer)]));
const idOf = (slice) => (slice.name ? `${slice.layer}/${slice.name}` : slice.layer);
const PUBLIC_ONLY = ['./index.ts', './index.tsx'];

function zonesFor(target, layerIndex) {
  const zones = [];
  for (const [index, layer] of LAYERS.entries()) {
    if (index < layerIndex) {
      zones.push({ target: target.dir, from: path.join(SRC, layer), message: ` ${target.layer}는 위 레이어(${layer})를 import하지 않는다.` });
      continue;
    }
    for (const other of SLICES[layer]) {
      if (other.dir === target.dir) continue;
      const sameLayer = index === layerIndex;
      const allowed = !sameLayer || layer === 'shared' || (SAME_LAYER_ALLOWED[idOf(target)] ?? []).includes(idOf(other));
      zones.push(
        allowed
          ? { target: target.dir, from: other.dir, except: PUBLIC_ONLY, message: ` ${idOf(other)}는 공개 API(index)로만 import한다.` }
          : { target: target.dir, from: other.dir, message: ` 같은 레이어의 다른 slice(${idOf(other)})는 import하지 않는다 - 공통 부분은 아래 레이어로.` },
      );
    }
  }
  if (target.name) {
    for (const file of ['index.ts', 'index.tsx']) {
      zones.push({ target: target.dir, from: path.join(target.dir, file), message: ' 자기 slice의 배럴(index)을 import하지 않는다 - 상대 경로로 직접 가져온다.' });
    }
  }
  return zones;
}

const BOUNDARY_ZONES = [
  ...LAYERS.flatMap((layer, layerIndex) => SLICES[layer].flatMap((slice) => zonesFor(slice, layerIndex))),
  // 테스트 픽스처는 레이어 밖이라 맨 위처럼 취급하되, 운영 레이어는 공개 API로만.
  ...zonesFor({ layer: 'test-fixtures', name: '', dir: path.join(SRC, 'test-fixtures') }, 0),
];

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
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'import-x': importX },
    settings: { 'import-x/resolver-next': [createTypeScriptImportResolver({ project: path.join(dirname, 'tsconfig.json') })] },
    rules: { 'import-x/no-restricted-paths': ['error', { basePath: dirname, zones: BOUNDARY_ZONES }] },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.ts', 'src/test-fixtures/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['@/test-fixtures', '@/test-fixtures/**', '**/test-fixtures/**'], message: '테스트 픽스처는 테스트에서만 쓴다.' }] }],
    },
  },
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
