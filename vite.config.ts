import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react({ babel: { plugins: [] } })],
  resolve: {
    alias: [
      { find: /^react-native$/, replacement: 'react-native-web' },
      { find: '@', replacement: path.resolve(dirname, 'src') },
    ],
    extensions: ['.web.tsx', '.web.ts', '.tsx', '.ts', '.jsx', '.js'],
  },
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
    /**
     * react-native-web의 Animated 구현(TimingAnimation 등)이 Node 스타일 전역 `global`을
     * 참조하는데, Vite/브라우저 번들에는 그게 없다 - Modal의 usePresenceAnimation(Animated
     * 사용)을 처음 추가하면서 "global is not defined"로 런타임에 즉시 크래시하는 걸 발견했다.
     */
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['react-native-web'],
    exclude: ['react-native'],
  },
});
