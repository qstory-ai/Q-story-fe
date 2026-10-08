import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import {
  installInteractionTracking,
  recordingConsentStore,
  setInteractionTrackingEnabled,
  setSessionRecordingPermitted,
  startSessionRecording,
  stopSessionRecording,
  trackScreenChange,
  useRecordingConsent,
} from '@/entities/analytics';
import { useAuth } from '@/entities/auth';

/** 앱을 연 주소 - 라우터가 주소를 바꾸기 전에 읽어 둔다(`?ut=1` UT 링크). */
const ENTRY_HREF = typeof window === 'undefined' ? null : window.location.href;

/** 팀 내부 화면(녹화 다시 보기)은 기록하지 않는다 - 녹화를 보는 화면이 다시 녹화되지 않게. */
function isInternalPath(pathname: string) {
  return pathname === '/internal' || pathname.startsWith('/internal/');
}

/**
 * 화면 사용 기록·화면 녹화를 켠다(라우터 안에 한 번). 경로가 바뀔 때마다 화면 이동을 남기고,
 * 녹화는 허용한 경우에만 첫 화면을 그린 뒤 한가할 때 시작한다. 아무것도 그리지 않는다.
 * 허용·이용 기록 설정은 recording-consent.ts가 정한다 - 로그인하면 계정 설정을 불러온다.
 */
export function UsageTracking() {
  const { pathname } = useLocation();
  const { state: authState } = useAuth();
  const token = authState.status === 'authenticated' ? authState.token : null;
  const authLoading = authState.status === 'loading';
  const { recordingPermitted, trackingEnabled } = useRecordingConsent();

  useEffect(() => {
    recordingConsentStore().applyEntryUrl(ENTRY_HREF);
    installInteractionTracking();
  }, []);

  useEffect(() => {
    if (!authLoading) void recordingConsentStore().setAuthToken(token);
  }, [authLoading, token]);

  useEffect(() => {
    setInteractionTrackingEnabled(trackingEnabled);
  }, [trackingEnabled]);

  useEffect(() => {
    if (isInternalPath(pathname)) {
      stopSessionRecording();
      return;
    }
    trackScreenChange(pathname);
  }, [pathname]);

  useEffect(() => {
    setSessionRecordingPermitted(recordingPermitted);
    if (recordingPermitted && !isInternalPath(pathname)) startSessionRecording();
  }, [pathname, recordingPermitted]);

  return null;
}
