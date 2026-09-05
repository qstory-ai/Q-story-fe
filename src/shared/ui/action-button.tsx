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

/**
 * 높이 스케일 - 예전엔 variant마다 52/44/48을 각자 하드코딩해서, 화면마다 버튼 높이가 미묘하게
 * 어긋나 있었다(Figma 커뮤니티 디자인 시스템의 Button 크기 스케일 구조를 참고해 도입).
 * record/stop은 이 스케일에 포함하지 않는다 - 위 주석대로 "색과 크기가 특수해 별도 유지"하는
 * 전용 컨트롤이라, 일반 라벨 버튼과 같은 사다리에 두면 의미가 없다.
 */
export type ActionButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_HEIGHT: Record<ActionButtonSize, number> = {
  sm: 40,
  md: 48,
  lg: 56,
};

/** size를 명시하지 않았을 때 variant별 기본 크기 - 가장 가까운 기존 값에 맞춰 골랐다
 * (primary/gold 52→lg 56, outline 48→md 48, secondary류 44→sm 40). */
const DEFAULT_SIZE_BY_VARIANT: Partial<Record<ActionButtonVariant, ActionButtonSize>> = {
  primary: 'lg',
  gold: 'lg',
  outline: 'md',
  secondary: 'sm',
  secondaryFull: 'sm',
};

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
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
  size,
  disabled = false,
  icon,
  loading = false,
}: ActionButtonProps) {
  const isSecondary = variant === 'secondary' || variant === 'secondaryFull';
  const isOutline = variant === 'outline';
  const isSizedVariant = variant !== 'record' && variant !== 'stop';
  const resolvedSize = size ?? DEFAULT_SIZE_BY_VARIANT[variant] ?? 'md';
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
        isSizedVariant && { minHeight: BUTTON_HEIGHT[resolvedSize] },
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
  // minHeight는 더 이상 여기 없다 - BUTTON_HEIGHT[resolvedSize]가 유일한 출처다
  // (record/stop만 예외로 아래에서 자기 높이를 직접 갖는다).
  base: {
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
    borderRadius: storybookTheme.radius.button,
    backgroundColor: storybookTheme.color.pillBackground,
    paddingHorizontal: storybookTheme.spacing.ms,
  },
  secondaryFull: {
    width: '100%',
    borderRadius: storybookTheme.radius.button,
    backgroundColor: storybookTheme.color.pillBackground,
    paddingHorizontal: storybookTheme.spacing.ms,
  },
  outline: {
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
  // opacity만 있던 press 피드백에 지침 표준 scale(0.96)을 함께. 프레스가 튐 없이
  // 손끝에 붙는 감이 살아난다 - 0.95 미만은 과장돼 보인다는 지침 따라 0.96 고정.
  pressed: { opacity: 0.9, transform: [{ scale: 0.96 }] },
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
