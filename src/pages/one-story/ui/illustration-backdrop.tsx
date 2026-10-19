import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';

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
 * 그레텔 대화 패널이 화면 아래를 덮는 동안(lifted)에는 그림 전체를 위로 올려 장면의 가운데가 패널 위에 보이게 한다.
 */
export function IllustrationBackdrop({
  illustration,
  attempt,
  hidden = false,
  lifted = false,
  accessibilityLabel,
}: {
  illustration: ImageSource;
  attempt: AttemptBackdropView;
  /** 리포트 화면처럼 배경 그림을 감출 때. */
  hidden?: boolean;
  /** 대화 패널이 아래를 덮는 중 - 그림을 화면 높이의 LIFT_RATIO만큼 위로 올린다. */
  lifted?: boolean;
  accessibilityLabel: string;
}) {
  const reduceMotion = useReducedMotion();
  // 애니메이션 값은 화면이 있는 동안 하나씩만 - useState 초기값으로 한 번 만든다.
  const [overlay] = useState(() => new Animated.Value(0));
  const [emphasis] = useState(() => new Animated.Value(0));
  const [lift] = useState(() => new Animated.Value(0));
  const { height } = useWindowDimensions();
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

  useEffect(() => {
    const animation = Animated.timing(lift, {
      toValue: lifted ? 1 : 0,
      duration: reduceMotion ? 0 : LIFT_MS,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [lift, lifted, reduceMotion]);
  const translateY = useMemo(
    () => lift.interpolate({ inputRange: [0, 1], outputRange: [0, -Math.min(height * LIFT_RATIO, LIFT_MAX)] }),
    [height, lift],
  );

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
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY }] }]}>
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
      </Animated.View>
    </View>
  );
}

// 대화 패널(화면 아래 최대 40%)이 덮는 만큼의 절반쯤 - 그림 위쪽이 너무 잘리지 않을 만큼만 올린다. 올라간 만큼
// 아래에 생기는 빈자리는 가장 낮은 패널(머리+말풍선 하나+버튼 줄)보다 작아야 패널 밖으로 드러나지 않는다.
const LIFT_RATIO = 0.18;
const LIFT_MAX = 140;
const LIFT_MS = 400;

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  hidden: { opacity: 0 },
  dim: { backgroundColor: '#000000' },
});
