import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const dirname = path.dirname(fileURLToPath(import.meta.url));

// 브라우저 에러 보고에 어느 배포인지 붙인다(Vercel이 빌드 때 커밋 SHA를 준다). 로컬은 비워 두면 dev.
process.env.VITE_QSTORY_RELEASE ??= (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^react-native$/, replacement: 'react-native-web' },
      { find: '@', replacement: path.resolve(dirname, 'src') },
    ],
    extensions: ['.web.tsx', '.web.ts', '.tsx', '.ts', '.jsx', '.js'],
  },
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
    // react-native-web의 Animated 구현이 Node 스타일 전역 `global`을 참조한다 - 없으면
    // "global is not defined"로 런타임에 크래시한다.
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['react-native-web'],
    exclude: ['react-native'],
  },
});
