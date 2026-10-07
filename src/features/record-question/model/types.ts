import type { LocalRecordingArtifact } from '@/entities/story-runtime';

import type { LevelFrame } from './silence-detector';

export type RecorderPermissionState = 'unknown' | 'granted' | 'denied';

export type RecorderPermissionFailure =
  | 'denied'
  | 'timeout'
  | 'unsupported'
  | 'insecure'
  | 'device-missing'
  | 'device-busy'
  | 'unknown';

export type RecorderRuntimeInfo = {
  browserKind:
    | 'samsung-internet'
    | 'chrome'
    | 'safari'
    | 'android-webview'
    | 'in-app-browser'
    | 'other';
  browserLabel: string;
  isSecureContext: boolean;
  hasGetUserMedia: boolean;
  isLikelyEmbedded: boolean;
};

export type RecordingResult = LocalRecordingArtifact & {
  /**
   * 브라우저가 임시 blob URL을 무효화하기 전에 캡처해 둔 업로드 소스.
   */
  uploadBlob?: Blob;
};

export type AudioRecorderAdapter = {
  permissionState: RecorderPermissionState;
  permissionRequestPending: boolean;
  isRecording: boolean;
  durationMillis: number;
  meteringDb: number | null;
  recordingResult: RecordingResult | null;
  error: string | null;
  permissionFailure: RecorderPermissionFailure | null;
  runtimeInfo: RecorderRuntimeInfo | null;
  requestPermission: () => Promise<boolean>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<RecordingResult | null>;
  resetRecording: () => void;
  /** 녹음 중 100ms마다 소리 크기 프레임을 받는다(측정할 수 없는 브라우저에선 오지 않는다). 해제 함수를 돌려준다. */
  subscribeLevel: (listener: (frame: LevelFrame) => void) => () => void;
};
