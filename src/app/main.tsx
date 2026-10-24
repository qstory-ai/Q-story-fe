import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { installGlobalErrorReporting, reportClientError } from '@/entities/analytics';

import { App } from './App';
import { installStaleChunkReload, reloadIfStaleChunk } from './stale-chunk-reload';

import './global.css';

installGlobalErrorReporting();
installStaleChunkReload();

// 화면을 그리다 난 에러(흰 화면이 되는 경우)도 보고한다. 기본 동작(콘솔 출력)은 그대로 둔다.
createRoot(document.getElementById('root')!, {
  onUncaughtError: (error, info) => {
    console.error(error);
    const message = error instanceof Error ? error.message : String(error);
    reportClientError({ kind: 'RENDER', message, stack: info.componentStack });
    // 배포 뒤 오래 열어 둔 탭이면 새 화면 조각을 받으러 한 번 새로 고친다(stale-chunk-reload).
    reloadIfStaleChunk(message);
  },
}).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
