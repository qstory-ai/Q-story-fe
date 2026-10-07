import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { installGlobalErrorReporting, reportClientError } from '@/entities/analytics';

import { App } from './App';

import './global.css';

installGlobalErrorReporting();

// 화면을 그리다 난 에러(흰 화면이 되는 경우)도 보고한다. 기본 동작(콘솔 출력)은 그대로 둔다.
createRoot(document.getElementById('root')!, {
  onUncaughtError: (error, info) => {
    console.error(error);
    reportClientError({
      kind: 'RENDER',
      message: error instanceof Error ? error.message : String(error),
      stack: info.componentStack,
    });
  },
}).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
