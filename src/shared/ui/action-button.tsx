import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { storybookTheme } from './theme';

/**
 * 버튼 variant 카탈로그. Toss식 정돈에서 변경된 부분:
 *  - `primary`: 브랜드 보라 채움. 로그인/회원가입 등 인증 흐름의 주된 CTA.
 *  - `gold`: 골드 채움. 이야기 시작·구독 등 앱 안에서 가장 강조하고 싶은 액션.
 *  - `secondary` / `secondaryFull`: 낮은 채도의 배경만. secondary는 자연 폭, secondaryFull은
 *    full width로 명확히 갈랐다.
 *  - `outline`: 새로 추가. 다크 배경 위에서 취소·해제 같은 낮은 위계 액션에 쓴다.
 *  - `record`/`stop`: 이야기 녹음/중지 전용 - 색과 크기가 특수해 별도 유지.
 */
export type ActionButtonVariant =
  | 'primary'
  | 'secondary'
  | 'secondaryFull'
  | 'outline'
  | 'record'
  | 'stop'
  | 'gold';

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ActionButtonVariant;
  disabled?: boolean;
  icon?: string;
  /** Solid 2.0 버튼 상태 카탈로그의 Loading - 라벨 대신 스피너를 보여주고 프레스를 막는다. */
  loading?: boolean;
};

/**
 * 앱 전역 CTA. 라운드/높이는 theme.radius.button, theme.spacing 등 토큰만 참조한다 -
 * 예전엔 각 variant가 17/15/18 등 다른 라운드를 하드코딩하고 있어서 페이지마다 톤이 달랐다.
 */
export function ActionButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  icon,
  loading = false,
}: ActionButtonProps) {
  const isSecondary = variant === 'secondary' || variant === 'secondaryFull';
  const isOutline = variant === 'outline';
  const labelColor = variant === 'primary' || variant === 'record' || variant === 'stop'
    ? storybookTheme.color.onDark
    : variant === 'gold'
      ? storybookTheme.semantic.accent.onAccent
      : isOutline
        ? storybookTheme.color.onDark
        : storybookTheme.color.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      // react-native-web은 웹에서 Pressable의 style 콜백에 pressed 말고도 hovered를 실제로
      // 넘겨주지만, 이 프로젝트가 쓰는 RN 타입 선언(PressableStateCallbackType)에는 hovered가
      // 없다 - 런타임 동작은 맞고 타입 선언만 웹 확장을 안 담고 있는 경우라 여기서만 좁혀서 받는다.
      style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'primary' && hovered && !disabled && !loading && styles.primaryHovered,
        variant === 'secondary' && styles.secondary,
        variant === 'secondaryFull' && styles.secondaryFull,
        variant === 'outline' && styles.outline,
        variant === 'record' && styles.record,
        variant === 'stop' && styles.stop,
        variant === 'gold' && styles.gold,
        variant === 'gold' && hovered && !disabled && !loading && styles.goldHovered,
        pressed && !disabled && !loading && styles.pressed,
        disabled && !loading && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={labelColor} />
      ) : (
        <>
          {icon ? <Text style={[styles.icon, { color: labelColor }]}>{icon}</Text> : null}
          <Text
            style={[
              styles.label,
              { color: labelColor },
              isSecondary && styles.labelSecondary,
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: storybookTheme.radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: storybookTheme.spacing.sm,
    paddingHorizontal: storybookTheme.spacing.ml,
  },
  primary: {
    backgroundColor: storybookTheme.color.primary,
  },
  /** 웹 마우스 hover 전용 - 네이티브에서는 hovered가 항상 false라 적용되지 않는다. */
  primaryHovered: {
    backgroundColor: storybookTheme.semantic.brand.hover,
  },
  secondary: {
    minHeight: 44,
    borderRadius: storybookTheme.radius.button,
    backgroundColor: storybookTheme.color.pillBackground,
    paddingHorizontal: storybookTheme.spacing.ms,
  },
  secondaryFull: {
    width: '100%',
    minHeight: 44,
    borderRadius: storybookTheme.radius.button,
    backgroundColor: storybookTheme.color.pillBackground,
    paddingHorizontal: storybookTheme.spacing.ms,
  },
  outline: {
    minHeight: 48,
    borderRadius: storybookTheme.radius.button,
    borderWidth: 1,
    borderColor: storybookTheme.color.panelOnDarkBorder,
    backgroundColor: 'transparent',
  },
  record: {
    minHeight: 60,
    backgroundColor: storybookTheme.color.error,
    borderRadius: 18,
  },
  stop: {
    minHeight: 56,
    backgroundColor: storybookTheme.color.error,
    borderRadius: 17,
  },
  /** landing의 button--gold를 참고한 골드 채움 - 서재의 "구독하고 전체 보기" 같은 CTA용. */
  gold: {
    backgroundColor: storybookTheme.color.gold,
  },
  goldHovered: {
    backgroundColor: storybookTheme.semantic.accent.hover,
  },
  pressed: { opacity: 0.85 },
  disabled: {
    opacity: 0.5,
  },
  icon: {
    fontSize: storybookTheme.type.xs,
  },
  label: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.bold,
    letterSpacing: -0.2,
  },
  labelSecondary: {
    fontSize: storybookTheme.type.sm,
  },
});
