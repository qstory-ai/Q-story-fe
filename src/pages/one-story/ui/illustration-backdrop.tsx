import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';

import type { ImageSource } from '@/entities/story';
import { useReducedMotion } from '@/shared/ui';

import {
  BACKDROP_EMPHASIS_DIM,
  backdropMotion,
  type AttemptBackdropView,
} from '../lib/attempt-backdrop';
import { ILLUSTRATION_ASPECT, illustrationFrame } from '../lib/illustration-frame';

/**
 * 리더 배경 삽화. 질문 초대 시도 장면이 막힌 줄에 오면 지금 그림 위로 막힌 모습의 그림을 크로스페이드하고(약 600ms), 맞는
 * 그림이 없으면 지금 그림을 천천히 살짝 확대하고 어둡게 한다. 시도 장면이 끝나면 같은 빠르기로 원래 그림으로 돌아온다.
 * RN Animated(JS 구동)라 웹·iOS·Android 앱(같은 웹 화면) 모두 같은 모양이고, 동작 줄이기 설정이면 바로 바꾸고 확대하지 않는다.
 *
 * 그레텔 대화 패널이 화면 아래를 덮는 동안(fitted)에는 그림을 밀어 올리지 않는다 - 그러면 위가 잘리고 아래에 빈자리가
 * 생겼다(10/21 QA). 대신 패널 위에 남는 영역(패널 실제 높이 fitBottomInset, 모르면 40%)에 그림을 화면 너비에 맞춰 위에서부터
 * 깔고, 넘치는 아래만 잘라 낸다 - 삽화는 아래 40%를 비워 두고 그린다. 영역이 그림보다 길면(세로 화면) 남는 아래는 같은 그림을
 * 흐리고 어둡게 깐 것이 채운다. 10/24 QA: 높이 60%에 `contain`으로 맞추니 PC에서 그림이 작게 떠 양옆이 흐린 채로 보였다.
 * 꽉 찬 그림과 맞춘 그림은 400ms 크로스페이드로 오간다.
 *
 * 패널이 닫혀 있을 때도 가운데 기준 `cover`로 자르지 않는다(lib/illustration-frame) - 넓은 화면은 아래만 자르고, 아이패드처럼
 * 좁은 화면은 양옆을 조금만 자른 뒤 남는 아래를 흐린 바탕이 채운다(10/24 기기별 미리보기).
 */
export function IllustrationBackdrop({
  illustration,
  attempt,
  hidden = false,
  fitted = false,
  fitBottomInset = null,
  accessibilityLabel,
}: {
  illustration: ImageSource;
  attempt: AttemptBackdropView;
  /** 리포트 화면처럼 배경 그림을 감출 때. */
  hidden?: boolean;
  /** 대화 패널이 아래를 덮는 중 - 그림을 패널 위 영역에 맞추고 여백은 흐린 그림으로 채운다. */
  fitted?: boolean;
  /** 대화 패널 높이(px). 모르면 화면의 40%로 본다. */
  fitBottomInset?: number | null;
  accessibilityLabel: string;
}) {
  const reduceMotion = useReducedMotion();
  // 애니메이션 값은 화면이 있는 동안 하나씩만 - useState 초기값으로 한 번 만든다.
  const [overlay] = useState(() => new Animated.Value(0));
  const [emphasis] = useState(() => new Animated.Value(0));
  const [fit] = useState(() => new Animated.Value(0));
  const [screen, setScreen] = useState({ width: 0, height: 0 });
  const frame = illustrationFrame(screen.width, screen.height);
  const fullStyle = frame ? { position: 'absolute' as const, ...frame } : StyleSheet.absoluteFill;
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

  // 지금 그림 + 시도 장면 그림 + 어둡게 - 꽉 찬 층과 너비에 맞춘 층(위에서부터)이 같은 애니메이션 값을 나눠 쓴다.
  const layers = (imageStyle: typeof fullStyle | typeof styles.widthFit, labelled: boolean) => (
    <>
      <Animated.Image
        source={illustration}
        resizeMode="cover"
        style={[imageStyle, { transform: [{ scale }] }]}
        accessibilityLabel={labelled ? accessibilityLabel : undefined}
        accessibilityElementsHidden={!labelled}
        importantForAccessibility={labelled ? 'auto' : 'no-hide-descendants'}
      />
      {overlayImage && (
        <Animated.Image
          source={overlayImage}
          resizeMode="cover"
          style={[imageStyle, { opacity: overlay }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      )}
      <Animated.View style={[StyleSheet.absoluteFill, styles.dim, { opacity: dim }]} />
    </>
  );

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.frame, hidden && styles.hidden]}
      pointerEvents="none"
      onLayout={(event) => setScreen(event.nativeEvent.layout)}
    >
      {/* 흐린 바탕 - 그림이 화면을 다 덮지 못할 때(좁은 화면, 패널을 열어 그림을 맞출 때) 남는 자리를 채운다. */}
      <View style={StyleSheet.absoluteFill}>
        <Image
          source={illustration}
          resizeMode="cover"
          blurRadius={BLUR_RADIUS}
          style={[StyleSheet.absoluteFill, styles.blurred]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <View style={[StyleSheet.absoluteFill, styles.blurShade]} />
      </View>
      {/* 꽉 찬 그림 - 패널이 닫혀 있을 때. */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fullOpacity }]}>{layers(fullStyle, true)}</Animated.View>
      {/* 패널 위 영역에 맞춘 그림 - 패널이 열려 있을 때. */}
      <Animated.View
        style={[styles.fitArea, fitBottomInset ? { bottom: fitBottomInset } : styles.fitAreaDefault, { opacity: fit }]}
      >
        {layers(styles.widthFit, false)}
      </Animated.View>
    </View>
  );
}

// 대화 패널 높이를 아직 모를 때 - 패널은 화면 아래 최대 40%를 덮는다(dialogue-panel.tsx panel.root maxHeight).
const PANEL_RATIO = 0.4;
const FIT_MS = 400;
// 흐린 바탕은 "무슨 그림인지"만 비치면 된다 - 흐림을 크게, 살짝 키워 흐림 가장자리의 비침을 가린다.
const BLUR_RADIUS = 28;

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  hidden: { opacity: 0 },
  dim: { backgroundColor: '#000000' },
  fitArea: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  fitAreaDefault: { height: `${Math.round((1 - PANEL_RATIO) * 100)}%` },
  widthFit: { position: 'absolute', top: 0, left: 0, width: '100%', aspectRatio: ILLUSTRATION_ASPECT },
  blurred: { transform: [{ scale: 1.08 }] },
  blurShade: { backgroundColor: 'rgba(0, 0, 0, 0.45)' },
});
