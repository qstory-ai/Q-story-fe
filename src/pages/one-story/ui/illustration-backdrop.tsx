import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import type { ImageSource } from '@/entities/story';
import { useReducedMotion } from '@/shared/ui';

import {
  BACKDROP_EMPHASIS_DIM,
  backdropMotion,
  type AttemptBackdropView,
} from '../lib/attempt-backdrop';

/**
 * 리더 배경 삽화. 질문 초대 시도 장면이 막힌 줄에 오면 지금 그림 위로 막힌 모습의 그림을 크로스페이드하고(약 600ms), 맞는
 * 그림이 없으면 지금 그림을 천천히 살짝 확대하고 어둡게 한다. 시도 장면이 끝나면 같은 빠르기로 원래 그림으로 돌아온다.
 * RN Animated(JS 구동)라 웹·iOS·Android 앱(같은 웹 화면) 모두 같은 모양이고, 동작 줄이기 설정이면 바로 바꾸고 확대하지 않는다.
 */
export function IllustrationBackdrop({
  illustration,
  attempt,
  hidden = false,
  accessibilityLabel,
}: {
  illustration: ImageSource;
  attempt: AttemptBackdropView;
  /** 리포트 화면처럼 배경 그림을 감출 때. */
  hidden?: boolean;
  accessibilityLabel: string;
}) {
  const reduceMotion = useReducedMotion();
  // 애니메이션 값은 화면이 있는 동안 하나씩만 - useState 초기값으로 한 번 만든다.
  const [overlay] = useState(() => new Animated.Value(0));
  const [emphasis] = useState(() => new Animated.Value(0));
  // 원래 그림으로 돌아가는 동안에도 시도 장면 그림이 보이며 사라지도록 마지막 그림을 들고 있는다.
  const [overlayImage, setOverlayImage] = useState<ImageSource | null>(null);
  const shownImage = attempt.kind === 'image' ? attempt.image : null;
  if (shownImage && shownImage !== overlayImage) {
    setOverlayImage(shownImage);
  }

  const motion = backdropMotion(attempt, reduceMotion);
  useEffect(() => {
    const animation = Animated.timing(overlay, {
      toValue: motion.overlay,
      duration: motion.overlayMs,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [motion.overlay, motion.overlayMs, overlay]);
  useEffect(() => {
    const animation = Animated.timing(emphasis, {
      toValue: motion.emphasis,
      duration: motion.emphasisMs,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [emphasis, motion.emphasis, motion.emphasisMs]);

  const scale = useMemo(
    () => emphasis.interpolate({ inputRange: [0, 1], outputRange: [1, motion.scale] }),
    [emphasis, motion.scale],
  );
  const dim = useMemo(
    () => emphasis.interpolate({ inputRange: [0, 1], outputRange: [0, BACKDROP_EMPHASIS_DIM] }),
    [emphasis],
  );

  return (
    <View style={[StyleSheet.absoluteFill, styles.frame, hidden && styles.hidden]} pointerEvents="none">
      <Animated.Image
        source={illustration}
        resizeMode="cover"
        style={[StyleSheet.absoluteFill, { transform: [{ scale }] }]}
        accessibilityLabel={accessibilityLabel}
      />
      {overlayImage && (
        <Animated.Image
          source={overlayImage}
          resizeMode="cover"
          style={[StyleSheet.absoluteFill, { opacity: overlay }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      )}
      <Animated.View style={[StyleSheet.absoluteFill, styles.dim, { opacity: dim }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  hidden: { opacity: 0 },
  dim: { backgroundColor: '#000000' },
});
