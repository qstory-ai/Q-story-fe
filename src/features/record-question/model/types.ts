import type { LocalRecordingArtifact } from '@/entities/story-runtime';

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
   * Upload source captured before the browser can invalidate its temporary
   * blob URL.
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
};
