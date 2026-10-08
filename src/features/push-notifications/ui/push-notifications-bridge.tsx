import { useEffect, useRef } from 'react';
import { useNavigate, type NavigateFunction } from 'react-router-dom';

import { hrefWithFrom } from '@/entities/analytics';
import { onBeforeLogout, useAuth } from '@/entities/auth';

import { beginPushSession, endPushSession, isPushSupported, startPush } from '../model/native-push';

/**
 * 태블릿 앱(안드로이드·아이패드)의 푸시 알림을 로그인 상태와 라우터에 잇는다(라우터 안에 한 번). 아무것도 그리지 않는다.
 * 알림을 누르면 data.href(앱 안 경로)로 이동한다.
 */
export function PushNotificationsBridge() {
  const navigate = useNavigate();
  const navigateRef = useRef<NavigateFunction>(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  const { state } = useAuth();
  const authToken = state.status === 'authenticated' ? state.token : null;
  const userId = state.status === 'authenticated' ? state.user.id : null;
  const authLoading = state.status === 'loading';

  useEffect(() => {
    if (!isPushSupported()) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    void startPush((href) => navigateRef.current(hrefWithFrom(href, 'notification'))).then((cleanup) => {
      if (cancelled) cleanup();
      else stop = cleanup;
    });
    // 로그아웃은 저장된 토큰을 지우기 전에 이 훅을 부른다 - 그 토큰으로 서버에서 이 기기를 푼다.
    const offLogout = onBeforeLogout((token) => endPushSession(token));
    return () => {
      cancelled = true;
      stop?.();
      offLogout();
    };
  }, []);

  useEffect(() => {
    if (!isPushSupported() || authLoading) return;
    if (authToken && userId) void beginPushSession(authToken, userId);
    // 토큰이 만료돼 익명이 된 경우 - 서버 해제 요청은 못 보내니 이 기기 쪽 상태만 정리한다.
    else endPushSession();
  }, [authLoading, authToken, userId]);

  return null;
}
