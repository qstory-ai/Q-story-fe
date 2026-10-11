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

/** 실시간 받아 적기 - 녹음(blob)과 함께 16kHz PCM 100ms 조각을 흘려보낸다. 둘 다 없으면 지금처럼 녹음만 한다. */
export type RecordingStartOptions = {
  onPcmFrame?: (frame: Int16Array) => void;
  /** 이 기기·상태에서는 PCM을 뽑을 수 없다(AudioContext 멈춤·미지원) - 호출부는 실시간 받아 적기를 접는다. */
  onPcmUnavailable?: () => void;
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
  startRecording: (options?: RecordingStartOptions) => Promise<void>;
  stopRecording: () => Promise<RecordingResult | null>;
  /** 남은 PCM 조각을 다 내보내고 PCM 흘려보내기를 멈춘다(녹음은 그대로). stopRecording도 부르지만, 끝 신호를 빨리 보내려면 먼저 부른다. */
  finishPcmCapture: () => Promise<void>;
  resetRecording: () => void;
  /** 녹음 중 100ms마다 소리 크기 프레임을 받는다(측정할 수 없는 브라우저에선 오지 않는다). 해제 함수를 돌려준다. */
  subscribeLevel: (listener: (frame: LevelFrame) => void) => () => void;
};
