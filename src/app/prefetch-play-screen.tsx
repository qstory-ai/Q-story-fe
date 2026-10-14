import { useEffect } from 'react';

import { useAuth } from '@/entities/auth';

/** 이야기 화면(StoryPlayerRoute·OneStoryPage, 데모 리더 포함)의 코드 묶음. App.tsx의 lazy()와 같은 모듈이라 같은 청크다. */
const loadPlayScreen = () => import('@/pages/one-story');

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

let started = false;
const PREFETCH_DELAY_MS = 1500;

/**
 * 가장 자주 들어가는 이야기 화면 코드를 브라우저가 한가할 때 미리 받아 둔다 - 책을 누른 뒤 코드 묶음을 기다리는
 * 시간을 없앤다. 로그인했거나 데모가 있는 첫 화면(`/`)에서만 받는다. 데이터 절약 모드면 받지 않는다.
 */
export function PrefetchPlayScreen() {
  const { state } = useAuth();
  const wanted =
    state.status === 'authenticated' || (typeof window !== 'undefined' && window.location.pathname === '/');

  useEffect(() => {
    if (!wanted || started || typeof window === 'undefined') return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData) return;
    const idleWindow = window as IdleWindow;
    const run = () => {
      if (started) return;
      started = true;
      loadPlayScreen().catch(() => {
        // 미리 받기 실패는 무시한다 - 들어갈 때 lazy()가 다시 받는다.
        started = false;
      });
    };
    // 첫 화면의 코드·데이터와 다투지 않게 페이지 load 뒤 잠시 기다렸다가, 그다음 한가할 때 받는다.
    // Safari(아이패드)는 requestIdleCallback이 없을 수 있어 그때는 지연만 쓴다.
    let timer: number | undefined;
    let idle: number | undefined;
    const schedule = () => {
      timer = window.setTimeout(() => {
        if (idleWindow.requestIdleCallback) idle = idleWindow.requestIdleCallback(run, { timeout: 3000 });
        else run();
      }, PREFETCH_DELAY_MS);
    };
    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });
    return () => {
      window.removeEventListener('load', schedule);
      if (timer !== undefined) window.clearTimeout(timer);
      if (idle !== undefined) idleWindow.cancelIdleCallback?.(idle);
    };
  }, [wanted]);

  return null;
}
