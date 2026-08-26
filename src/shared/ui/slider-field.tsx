import { useMemo, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';

import { storybookTheme } from './theme';

type SliderFieldProps = {
  label?: string;
  description?: string;
  min?: number;
  max?: number;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  /** 라벨 옆 우측 값 표시 텍스트 - 기본은 숫자 그대로("0-100" 같은 커스텀 표기는 이걸로). */
  formatValue?: (value: number) => string;
};

/** 드래그로 값을 고르는 슬라이더 - Figma "Slider Field". RN 코어엔 슬라이더가 없어 PanResponder로
 * 직접 구현한다(react-native-web도 지원하는 responder 시스템). */
export function SliderField({
  label,
  description,
  min = 0,
  max = 100,
  value,
  onChange,
  disabled,
  formatValue,
}: SliderFieldProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const clamp = (candidate: number) => Math.min(max, Math.max(min, candidate));
  const ratio = trackWidth > 0 && max > min ? (clamp(value) - min) / (max - min) : 0;

  const updateFromX = (x: number) => {
    if (trackWidth <= 0) return;
    const nextRatio = Math.min(1, Math.max(0, x / trackWidth));
    onChange(Math.round(min + nextRatio * (max - min)));
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderGrant: (event) => updateFromX(event.nativeEvent.locationX),
        onPanResponderMove: (event) => updateFromX(event.nativeEvent.locationX),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabled, trackWidth, min, max],
  );

  return (
    <View style={styles.container}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={[styles.label, disabled && styles.labelDisabled]}>{label}</Text>
          <Text style={[styles.output, disabled && styles.labelDisabled]}>
            {formatValue ? formatValue(value) : value}
          </Text>
        </View>
      ) : null}
      <View
        style={styles.track}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        accessibilityRole="adjustable"
        accessibilityValue={{ min, max, now: value }}
        {...panResponder.panHandlers}
      >
        <View style={[styles.fill, { width: `${ratio * 100}%` }, disabled && styles.fillDisabled]} />
        <View style={[styles.knob, { left: `${ratio * 100}%`, marginLeft: -8 } as never, disabled && styles.knobDisabled]} />
      </View>
      {description ? <Text style={[styles.description, disabled && styles.labelDisabled]}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: storybookTheme.spacing.ms },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.medium,
    color: storybookTheme.color.onLightBody,
  },
  output: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onLightMuted },
  labelDisabled: { color: storybookTheme.color.disabledText },
  description: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onLightMuted },
  track: {
    height: 8,
    borderRadius: storybookTheme.radius.pill,
    backgroundColor: storybookTheme.color.pillBackground,
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: storybookTheme.radius.pill,
    backgroundColor: storybookTheme.color.primary,
  },
  fillDisabled: { backgroundColor: storybookTheme.color.disabledBorder },
  knob: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: storybookTheme.color.primary,
  },
  knobDisabled: {
    backgroundColor: storybookTheme.color.disabledBackground,
    borderWidth: 1,
    borderColor: storybookTheme.color.disabledBorder,
  },
});
