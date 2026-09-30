import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const dirname = path.dirname(fileURLToPath(import.meta.url));

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
