import { createElement, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type RecordingPreviewProps = {
  uri: string;
  onReady: () => void;
  onStarted: () => void;
  onError: (message: string) => void;
};

type PreviewState = 'idle' | 'loading' | 'playing' | 'finished' | 'error';

export function RecordingPreview({
  uri,
  onReady,
  onStarted,
  onError,
}: RecordingPreviewProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackStartedRef = useRef(false);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [previewState, setPreviewState] = useState<PreviewState>('idle');
  const [playbackConfirmed, setPlaybackConfirmed] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;

    return () => {
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
      }
      audio?.pause();
    };
  }, [uri]);

  const confirmPlayback = () => {
    if (playbackStartedRef.current) {
      return;
    }
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
    }
    playbackStartedRef.current = true;
    setPlaybackConfirmed(true);
    setPreviewState('playing');
    onReady();
    onStarted();
  };

  const handlePlay = async () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audio.ended) {
      audio.currentTime = 0;
    }

    playbackStartedRef.current = false;
    setPreviewState('loading');

    try {
      await audio.play();
      confirmPlayback();
    } catch (playbackError) {
      setPreviewState('error');
      onError(
        playbackError instanceof Error
          ? playbackError.message
          : '브라우저가 녹음 재생을 시작하지 못했어요.',
      );
    }
  };

  const buttonLabel =
    previewState === 'loading'
      ? '재생 준비 중…'
      : previewState === 'playing'
        ? '내 목소리 재생 중…'
        : playbackConfirmed
          ? '내 목소리 다시 들어보기'
          : '내 목소리 들어보기';

  return (
    <View style={styles.container}>
      {createElement('audio', {
        'aria-hidden': true,
        hidden: true,
        onCanPlay: onReady,
        onEnded: () => {
          setPreviewState('finished');
        },
        onError: (event) => {
          const audio = event.currentTarget as HTMLAudioElement;
          if (!playbackStartedRef.current && previewState !== 'loading') {
            return;
          }

          if (errorTimerRef.current) {
            clearTimeout(errorTimerRef.current);
          }
          errorTimerRef.current = setTimeout(() => {
            if (
              !playbackStartedRef.current &&
              audio.paused &&
              audio.currentTime === 0
            ) {
              const code = audio.error?.code;
              setPreviewState('error');
              onError(
                code
                  ? `브라우저 녹음 재생 오류 코드 ${code}`
                  : '브라우저가 녹음 파일을 재생하지 못했어요.',
              );
            }
          }, 400);
        },
        onLoadedData: onReady,
        onPause: (event) => {
          const audio = event.currentTarget as HTMLAudioElement;
          if (playbackStartedRef.current && !audio.ended) {
            setPreviewState('finished');
          }
        },
        onPlaying: confirmPlayback,
        playsInline: true,
        preload: 'none',
        ref: audioRef,
        src: uri,
      })}
      <Pressable
        accessibilityRole="button"
        disabled={previewState === 'loading' || previewState === 'playing'}
        onPress={handlePlay}
        style={({ pressed }) => [
          styles.button,
          (previewState === 'loading' || previewState === 'playing') &&
            styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}>
        <Text style={styles.buttonText}>{buttonLabel}</Text>
      </Pressable>
      <Text
        style={[
          styles.statusText,
          playbackConfirmed && styles.statusTextConfirmed,
          previewState === 'error' && styles.statusTextError,
        ]}>
        {previewState === 'error'
          ? '재생을 확인하지 못했어요.'
          : playbackConfirmed
            ? '✓ 실제 녹음 재생 확인됨'
            : '버튼을 눌러 실제 녹음이 들리는지 확인해 주세요.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 7,
    marginBottom: 10,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#FFCC00',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonPressed: {
    transform: [{ scale: 0.99 }],
  },
  buttonText: {
    color: '#2B1A4A',
    fontSize: 14,
    fontWeight: '900',
  },
  statusText: {
    color: '#746A80',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
  statusTextConfirmed: {
    color: '#176B38',
    fontWeight: '800',
  },
  statusTextError: {
    color: '#B23A48',
    fontWeight: '800',
  },
});
