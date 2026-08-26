import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  AudioRecorderAdapter,
  RecorderPermissionFailure,
  RecorderPermissionState,
  RecorderRuntimeInfo,
  RecordingResult,
} from './types';

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
] as const;
const PERMISSION_REQUEST_TIMEOUT_MS = 9_000;
const METERING_INTERVAL_MS = 100;

class MicrophoneRequestTimeoutError extends Error {
  constructor() {
    super('Microphone permission request timed out');
    this.name = 'MicrophoneRequestTimeoutError';
  }
}

function readWebRuntimeInfo(): RecorderRuntimeInfo {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return {
      browserKind: 'other',
      browserLabel: '웹 브라우저',
      isSecureContext: false,
      hasGetUserMedia: false,
      isLikelyEmbedded: false,
    };
  }

  const userAgent = navigator.userAgent;
  const isSamsungInternet = /SamsungBrowser\//i.test(userAgent);
  const isAndroidWebView =
    /;\s*wv\)/i.test(userAgent) || /\bVersion\/4\.0\b.*\bwv\b/i.test(userAgent);
  const isKnownInAppBrowser =
    /(Instagram|FBAN|FBAV|KAKAOTALK|NAVER|DaumApps|Line\/)/i.test(userAgent);
  const isChrome = /(Chrome|CriOS)\//i.test(userAgent);
  const isSafari =
    /Safari\//i.test(userAgent) &&
    !/(Chrome|CriOS|Chromium|SamsungBrowser)\//i.test(userAgent);

  const browserKind = isSamsungInternet
    ? 'samsung-internet'
    : isAndroidWebView
      ? 'android-webview'
      : isKnownInAppBrowser
        ? 'in-app-browser'
        : isChrome
          ? 'chrome'
          : isSafari
            ? 'safari'
            : 'other';
  const browserLabel =
    browserKind === 'samsung-internet'
      ? 'Samsung Internet'
      : browserKind === 'android-webview'
        ? 'Android 앱 내부 브라우저'
        : browserKind === 'in-app-browser'
          ? '앱 내부 브라우저'
          : browserKind === 'chrome'
            ? 'Chrome'
            : browserKind === 'safari'
              ? 'Safari'
              : '웹 브라우저';

  return {
    browserKind,
    browserLabel,
    isSecureContext: window.isSecureContext,
    hasGetUserMedia:
      typeof navigator.mediaDevices?.getUserMedia === 'function',
    isLikelyEmbedded: isAndroidWebView || isKnownInAppBrowser,
  };
}

function permissionErrorDetails(error: unknown): {
  failure: RecorderPermissionFailure;
  permissionState: RecorderPermissionState;
  message: string;
} {
  if (error instanceof MicrophoneRequestTimeoutError) {
    return {
      failure: 'timeout',
      permissionState: 'unknown',
      message:
        '마이크 권한 창을 확인하지 못했어요. 브라우저 앱과 이 사이트의 마이크 권한을 확인한 뒤 다시 시도해 주세요.',
    };
  }

  const errorName =
    error instanceof DOMException || error instanceof Error ? error.name : '';

  if (errorName === 'NotAllowedError' || errorName === 'SecurityError') {
    return {
      failure: 'denied',
      permissionState: 'denied',
      message:
        '마이크 권한이 차단되어 있어요. 브라우저 앱과 이 사이트의 마이크 권한을 허용한 뒤 다시 시도해 주세요.',
    };
  }

  if (errorName === 'NotFoundError') {
    return {
      failure: 'device-missing',
      permissionState: 'unknown',
      message:
        '사용할 수 있는 마이크를 찾지 못했어요. 기기의 마이크 상태를 확인해 주세요.',
    };
  }

  if (errorName === 'NotReadableError' || errorName === 'AbortError') {
    return {
      failure: 'device-busy',
      permissionState: 'unknown',
      message:
        '다른 앱이나 통화가 마이크를 사용 중일 수 있어요. 사용을 마친 뒤 다시 시도해 주세요.',
    };
  }

  return {
    failure: 'unknown',
    permissionState: 'unknown',
    message:
      error instanceof Error
        ? `마이크를 준비하지 못했어요. ${error.message}`
        : '브라우저에서 마이크를 준비하지 못했어요.',
  };
}

function selectWebMimeType() {
  if (
    typeof MediaRecorder === 'undefined' ||
    typeof MediaRecorder.isTypeSupported !== 'function'
  ) {
    return 'audio/webm';
  }

  return (
    MIME_CANDIDATES.find((candidate) =>
      MediaRecorder.isTypeSupported(candidate),
    ) ?? 'audio/webm'
  );
}

/** 실시간 미터링 바에 사용하기 위해 AnalyserNode에서 읽은 선형 진폭(0..1). */
function readPeakAmplitude(analyser: AnalyserNode, buffer: Uint8Array<ArrayBuffer>) {
  analyser.getByteTimeDomainData(buffer);
  let peak = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    peak = Math.max(peak, Math.abs(buffer[i] - 128) / 128);
  }
  return peak;
}

/** 선형 피크 진폭으로부터 expo-audio의 dBFS 미터링 스케일을 근사한다. */
function amplitudeToDb(amplitude: number) {
  if (amplitude <= 0) {
    return -160;
  }
  return Math.max(-160, 20 * Math.log10(amplitude));
}

export function useAudioRecorderAdapter(): AudioRecorderAdapter {
  const mimeType = useMemo(() => selectWebMimeType(), []);
  const [permissionState, setPermissionState] =
    useState<RecorderPermissionState>('unknown');
  const [permissionRequestPending, setPermissionRequestPending] = useState(false);
  const [permissionFailure, setPermissionFailure] =
    useState<RecorderPermissionFailure | null>(null);
  const runtimeInfo = useMemo<RecorderRuntimeInfo>(
    () => readWebRuntimeInfo(),
    [],
  );
  const [isRecording, setIsRecording] = useState(false);
  const [durationMillis, setDurationMillis] = useState(0);
  const [meteringDb, setMeteringDb] = useState<number | null>(null);
  const [recordingResult, setRecordingResult] =
    useState<RecordingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const meteringBufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const meteringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const peakMeteringRef = useRef(-160);
  const meteringObservedRef = useRef(false);
  const recordingStartedAtRef = useRef<number | null>(null);
  const stableRecordingUriRef = useRef<string | null>(null);
  const stopResolveRef = useRef<((result: RecordingResult | null) => void) | null>(
    null,
  );

  const releaseStableRecordingUri = useCallback(() => {
    if (stableRecordingUriRef.current) {
      URL.revokeObjectURL(stableRecordingUriRef.current);
      stableRecordingUriRef.current = null;
    }
  }, []);

  const stopMetering = useCallback(() => {
    if (meteringIntervalRef.current) {
      clearInterval(meteringIntervalRef.current);
      meteringIntervalRef.current = null;
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    analyserRef.current = null;
    meteringBufferRef.current = null;
    void audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(
    () => () => {
      stopMetering();
      releaseStream();
      releaseStableRecordingUri();
    },
    [releaseStableRecordingUri, releaseStream, stopMetering],
  );

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
      return;
    }

    navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then(({ state }) => {
        setPermissionState(
          state === 'granted'
            ? 'granted'
            : state === 'denied'
              ? 'denied'
              : 'unknown',
        );
      })
      .catch(() => {
        setPermissionState('unknown');
      });
  }, []);

  const requestPermission = useCallback(async () => {
    setPermissionRequestPending(true);
    setPermissionFailure(null);
    setError(null);

    let requestExpired = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      if (!runtimeInfo.isSecureContext) {
        setPermissionState('unknown');
        setPermissionFailure('insecure');
        setError('마이크는 HTTPS로 열린 안전한 주소에서만 사용할 수 있어요.');
        return false;
      }

      if (
        !runtimeInfo.hasGetUserMedia ||
        typeof MediaRecorder === 'undefined'
      ) {
        setPermissionState('unknown');
        setPermissionFailure('unsupported');
        setError(
          '이 브라우저에서는 음성 녹음을 시작할 수 없어요. 최신 Chrome, Safari 또는 Samsung Internet으로 열어 주세요.',
        );
        return false;
      }

      const streamRequest = navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          if (requestExpired) {
            stream.getTracks().forEach((track) => track.stop());
            throw new MicrophoneRequestTimeoutError();
          }
          return stream;
        });
      const timeoutRequest = new Promise<MediaStream>((_, reject) => {
        timeoutId = setTimeout(() => {
          requestExpired = true;
          reject(new MicrophoneRequestTimeoutError());
        }, PERMISSION_REQUEST_TIMEOUT_MS);
      });
      const stream = await Promise.race([streamRequest, timeoutRequest]);

      stream.getTracks().forEach((track) => track.stop());
      setPermissionState('granted');
      setPermissionFailure(null);
      return true;
    } catch (permissionError) {
      const details = permissionErrorDetails(permissionError);
      setPermissionState(details.permissionState);
      setPermissionFailure(details.failure);
      setError(details.message);
      return false;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      setPermissionRequestPending(false);
    }
  }, [runtimeInfo.hasGetUserMedia, runtimeInfo.isSecureContext]);

  const startRecording = useCallback(async () => {
    setError(null);
    setRecordingResult(null);
    releaseStableRecordingUri();
    peakMeteringRef.current = -160;
    meteringObservedRef.current = false;
    setMeteringDb(null);
    setDurationMillis(0);
    recordingStartedAtRef.current = null;
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioContextCtor =
        window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioContextCtor) {
        const audioContext = new AudioContextCtor();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        meteringBufferRef.current = new Uint8Array(analyser.fftSize);
        meteringIntervalRef.current = setInterval(() => {
          if (!analyserRef.current || !meteringBufferRef.current) {
            return;
          }
          const peak = readPeakAmplitude(
            analyserRef.current,
            meteringBufferRef.current,
          );
          const db = amplitudeToDb(peak);
          meteringObservedRef.current = true;
          peakMeteringRef.current = Math.max(peakMeteringRef.current, db);
          setMeteringDb(db);
        }, METERING_INTERVAL_MS);
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });
      recorder.addEventListener('stop', () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        stopMetering();
        releaseStream();

        const resolve = stopResolveRef.current;
        stopResolveRef.current = null;
        setIsRecording(false);

        if (blob.size === 0) {
          setError('브라우저가 빈 녹음 파일을 만들었어요.');
          resolve?.(null);
          return;
        }

        releaseStableRecordingUri();
        const stableRecordingUri = URL.createObjectURL(blob);
        stableRecordingUriRef.current = stableRecordingUri;
        const startedAt = recordingStartedAtRef.current;
        const durationFromClock =
          startedAt === null ? 0 : Date.now() - startedAt;
        const peakMeteringDb = meteringObservedRef.current
          ? peakMeteringRef.current
          : undefined;
        const result: RecordingResult = {
          uri: stableRecordingUri,
          durationMillis: Math.max(0, Math.round(durationFromClock)),
          mimeType: blob.type || mimeType,
          byteSize: blob.size,
          peakMeteringDb,
          uploadBlob: blob,
        };
        setRecordingResult(result);
        resolve?.(result);
      });

      recorder.start();
      setIsRecording(true);
      recordingStartedAtRef.current = Date.now();
      durationIntervalRef.current = setInterval(() => {
        const startedAt = recordingStartedAtRef.current;
        if (startedAt !== null) {
          setDurationMillis(Date.now() - startedAt);
        }
      }, METERING_INTERVAL_MS);
    } catch (recordingError) {
      recordingStartedAtRef.current = null;
      stopMetering();
      releaseStream();
      setError(
        recordingError instanceof Error
          ? recordingError.message
          : '브라우저 녹음을 시작하지 못했어요.',
      );
      throw recordingError;
    }
  }, [mimeType, releaseStableRecordingUri, releaseStream, stopMetering]);

  const stopRecording = useCallback(async () => {
    setError(null);
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      return null;
    }

    return new Promise<RecordingResult | null>((resolve) => {
      stopResolveRef.current = resolve;
      recorder.stop();
    });
  }, []);

  const resetRecording = useCallback(() => {
    releaseStableRecordingUri();
    setRecordingResult(null);
    setError(null);
    setPermissionFailure(null);
    setDurationMillis(0);
    setMeteringDb(null);
    recordingStartedAtRef.current = null;
    meteringObservedRef.current = false;
  }, [releaseStableRecordingUri]);

  return {
    permissionState,
    permissionRequestPending,
    isRecording,
    durationMillis,
    meteringDb,
    recordingResult,
    error,
    permissionFailure,
    runtimeInfo,
    requestPermission,
    startRecording,
    stopRecording,
    resetRecording,
  };
}
