import { useSyncExternalStore } from 'react';

import { recordingConsentStore, type RecordingConsentSnapshot } from './recording-consent';

/** 화면 녹화·이용 기록 동의 상태를 화면에서 본다(바뀌면 다시 그린다). */
export function useRecordingConsent(): RecordingConsentSnapshot {
  const store = recordingConsentStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
