import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import {
  installInteractionTracking,
  startSessionRecording,
  stopSessionRecording,
  trackScreenChange,
} from '@/entities/analytics';

/** 팀 내부 화면(녹화 다시 보기)은 기록하지 않는다 - 녹화를 보는 화면이 다시 녹화되지 않게. */
function isInternalPath(pathname: string) {
  return pathname === '/internal' || pathname.startsWith('/internal/');
}

/**
 * 화면 사용 기록·화면 녹화를 켠다(라우터 안에 한 번). 경로가 바뀔 때마다 화면 이동을 남기고,
 * 녹화는 첫 화면을 그린 뒤 한가할 때 시작한다. 아무것도 그리지 않는다.
 */
export function UsageTracking() {
  const { pathname } = useLocation();

  useEffect(() => {
    installInteractionTracking();
  }, []);

  useEffect(() => {
    if (isInternalPath(pathname)) {
      stopSessionRecording();
      return;
    }
    trackScreenChange(pathname);
    startSessionRecording();
  }, [pathname]);

  return null;
}
