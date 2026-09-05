import { StyleSheet, Text } from 'react-native';

import { storybookTheme } from './theme';

/**
 * 새 입력 필드 컴포넌트들(select/date/textarea/slider/switch/search 등)이 공유하는 라벨/설명/
 * 에러 텍스트와 상태별 색상 - Figma "Simple Design System"의 Field 컴포넌트군을 이 코드베이스의
 * TextField가 이미 쓰던 라벨 스타일(xs/medium/onLightBody)에 맞춰 옮긴 것이다. Figma 원본은
 * 라벨을 16px 기본 텍스트로 크게 쓰지만, 로그인/가입 등 17곳이 이미 지금 크기에 맞춰져 있어
 * 그 크기를 시스템 기준으로 삼는다.
 */
export type FieldState = 'default' | 'error' | 'disabled';

export function FieldLabel({ children, disabled }: { children: string; disabled?: boolean }) {
  return <Text style={[styles.label, disabled && styles.labelDisabled]}>{children}</Text>;
}

export function FieldDescription({ children, disabled }: { children: string; disabled?: boolean }) {
  return <Text style={[styles.description, disabled && styles.descriptionDisabled]}>{children}</Text>;
}

export function FieldError({ children }: { children: string }) {
  return (
    <Text style={styles.error} accessibilityLiveRegion="polite">
      {children}
    </Text>
  );
}

/** focused는 'default' 상태에서만 의미가 있다 - error/disabled는 이미 그 자체로 더
 * 우선순위 높은 신호라 focus 링보다 그대로 유지한다. */
export const fieldBorderColor = (state: FieldState, focused = false) =>
  state === 'error'
    ? storybookTheme.color.error
    : state === 'disabled'
      ? storybookTheme.color.disabledBorder
      : focused
        ? storybookTheme.color.primary
        : storybookTheme.color.lightCardBorder;

export const fieldBackgroundColor = (state: FieldState) =>
  state === 'disabled' ? storybookTheme.color.disabledBackground : storybookTheme.color.surfaceWhite;

export const fieldTextColor = (state: FieldState) =>
  state === 'disabled' ? storybookTheme.color.disabledText : storybookTheme.color.onCardTitle;

const styles = StyleSheet.create({
  label: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.medium,
    color: storybookTheme.color.onLightBody,
  },
  labelDisabled: { color: storybookTheme.color.disabledText },
  description: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onLightMuted,
  },
  descriptionDisabled: { color: storybookTheme.color.disabledText },
  error: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.error,
  },
});
