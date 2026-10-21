import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';

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
 *
 * 그레텔 대화 패널이 화면 아래(최대 40%)를 덮는 동안(fitted)에는 그림을 밀어 올리지 않는다 - 그러면 위가 잘리고 아래에
 * 빈자리가 생겼다(10/21 QA). 대신 패널 위에 남는 영역에 그림 전체를 `contain`으로 맞추고, 양옆·아래 여백은 같은 그림을
 * 크게 늘려 흐리고 어둡게 깐 것으로 채운다. 꽉 찬 그림과 맞춘 그림은 400ms 크로스페이드로 오간다.
 */
export function IllustrationBackdrop({
  illustration,
  attempt,
  hidden = false,
  fitted = false,
  accessibilityLabel,
}: {
  illustration: ImageSource;
  attempt: AttemptBackdropView;
  /** 리포트 화면처럼 배경 그림을 감출 때. */
  hidden?: boolean;
  /** 대화 패널이 아래를 덮는 중 - 그림을 패널 위 영역에 맞추고 여백은 흐린 그림으로 채운다. */
  fitted?: boolean;
  accessibilityLabel: string;
}) {
  const reduceMotion = useReducedMotion();
  // 애니메이션 값은 화면이 있는 동안 하나씩만 - useState 초기값으로 한 번 만든다.
  const [overlay] = useState(() => new Animated.Value(0));
  const [emphasis] = useState(() => new Animated.Value(0));
  const [fit] = useState(() => new Animated.Value(0));
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
    const animation = Animated.timing(fit, {
      toValue: fitted ? 1 : 0,
      duration: reduceMotion ? 0 : FIT_MS,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [fit, fitted, reduceMotion]);
  const fullOpacity = useMemo(() => fit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), [fit]);

  const scale = useMemo(
    () => emphasis.interpolate({ inputRange: [0, 1], outputRange: [1, motion.scale] }),
    [emphasis, motion.scale],
  );
  const dim = useMemo(
    () => emphasis.interpolate({ inputRange: [0, 1], outputRange: [0, BACKDROP_EMPHASIS_DIM] }),
    [emphasis],
  );

  // 지금 그림 + 시도 장면 그림 + 어둡게 - 꽉 찬 층(cover)과 맞춘 층(contain)이 같은 애니메이션 값을 나눠 쓴다.
  const layers = (resizeMode: 'cover' | 'contain', labelled: boolean) => (
    <>
      <Animated.Image
        source={illustration}
        resizeMode={resizeMode}
        style={[StyleSheet.absoluteFill, { transform: [{ scale }] }]}
        accessibilityLabel={labelled ? accessibilityLabel : undefined}
        accessibilityElementsHidden={!labelled}
        importantForAccessibility={labelled ? 'auto' : 'no-hide-descendants'}
      />
      {overlayImage && (
        <Animated.Image
          source={overlayImage}
          resizeMode={resizeMode}
          style={[StyleSheet.absoluteFill, { opacity: overlay }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      )}
      <Animated.View style={[StyleSheet.absoluteFill, styles.dim, { opacity: dim }]} />
    </>
  );

  return (
    <View style={[StyleSheet.absoluteFill, styles.frame, hidden && styles.hidden]} pointerEvents="none">
      {/* 흐린 바탕 - 패널이 열려 그림을 맞출 때 양옆·아래 여백을 채운다. */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fit }]}>
        <Image
          source={illustration}
          resizeMode="cover"
          blurRadius={BLUR_RADIUS}
          style={[StyleSheet.absoluteFill, styles.blurred]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <View style={[StyleSheet.absoluteFill, styles.blurShade]} />
      </Animated.View>
      {/* 꽉 찬 그림 - 패널이 닫혀 있을 때. */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fullOpacity }]}>{layers('cover', true)}</Animated.View>
      {/* 패널 위 영역에 맞춘 그림 - 패널이 열려 있을 때. */}
      <Animated.View style={[styles.fitArea, { opacity: fit }]}>{layers('contain', false)}</Animated.View>
    </View>
  );
}

// 대화 패널이 화면 아래 최대 40%를 덮는다(dialogue-panel.tsx panel.root maxHeight) - 그 위 60%에 그림을 맞춘다. 패널이
// 그보다 낮을 때 드러나는 자리는 흐린 바탕이 채운다.
const PANEL_RATIO = 0.4;
const FIT_MS = 400;
// 흐린 바탕은 "무슨 그림인지"만 비치면 된다 - 흐림을 크게, 살짝 키워 흐림 가장자리의 비침을 가린다.
const BLUR_RADIUS = 28;

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  hidden: { opacity: 0 },
  dim: { backgroundColor: '#000000' },
  fitArea: { position: 'absolute', top: 0, left: 0, right: 0, height: `${Math.round((1 - PANEL_RATIO) * 100)}%` },
  blurred: { transform: [{ scale: 1.08 }] },
  blurShade: { backgroundColor: 'rgba(0, 0, 0, 0.45)' },
});
