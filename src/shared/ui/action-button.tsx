import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { storybookTheme } from './theme';
import { borderWidth, minTouchTarget, radius, semanticColors, space } from './tokens';

const L = semanticColors.light;
const D = semanticColors.dark;

/**
 * 버튼 variant 카탈로그:
 *  - `primary`: 브랜드 Purple 500 채움. 로그인/회원가입 등 인증 흐름의 주된 CTA.
 *  - `gold`: 강조 채움(color.accentFill, 이름은 예전 골드 버튼에서 왔다). 이야기 시작·구독 등 가장 강조하고 싶은 액션.
 *  - `secondary` / `secondaryFull`: 낮은 채도의 배경만. secondary는 자연 폭, secondaryFull은 full width.
 *  - `outline`: 다크 배경 위에서 취소·해제 같은 낮은 위계 액션에 쓴다.
 *  - `ghost`: 배경·테두리 없이 글자만(밝은 바탕). 카드 안 "더 보기" 같은 가장 낮은 위계.
 *  - `danger`: 되돌릴 수 없는 액션(탈퇴·삭제 확인). Pink 700 채움 + 흰 글자.
 *  - `record`/`stop`: 이야기 녹음/중지 전용 - 색과 크기가 특수해 별도 유지.
 */
export type ActionButtonVariant =
  | 'primary'
  | 'secondary'
  | 'secondaryFull'
  | 'outline'
  | 'record'
  | 'stop'
  | 'gold'
  | 'ghost'
  | 'danger';

/** 높이 스케일. record/stop은 자기 높이를 따로 갖는 전용 컨트롤이라 포함하지 않는다. */
export type ActionButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_HEIGHT: Record<ActionButtonSize, number> = {
  sm: 40,
  md: 48,
  lg: 56,
};

/** size를 명시하지 않았을 때 variant별 기본 크기. */
const DEFAULT_SIZE_BY_VARIANT: Partial<Record<ActionButtonVariant, ActionButtonSize>> = {
  primary: 'lg',
  gold: 'lg',
  outline: 'md',
  secondary: 'sm',
  secondaryFull: 'sm',
  ghost: 'sm',
  danger: 'lg',
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
  /** 내부 UI 키트(/internal/ui-kit) 캡처용 - 상태를 고정해 보여 준다. 화면에서는 쓰지 않는다. */
  previewState?: 'hover' | 'pressed';
};

/** 앱 전역 CTA. 색·간격·라운드는 tokens.ts Semantic만 참조한다(variant × 기본/hover/pressed/disabled). */
export function ActionButton({
  label,
  onPress,
  variant = 'primary',
  size,
  disabled = false,
  icon,
  loading = false,
  previewState,
}: ActionButtonProps) {
  const isSecondary = variant === 'secondary' || variant === 'secondaryFull' || variant === 'ghost';
  const isOutline = variant === 'outline';
  const isSizedVariant = variant !== 'record' && variant !== 'stop';
  const resolvedSize = size ?? DEFAULT_SIZE_BY_VARIANT[variant] ?? 'md';
  const labelColor =
    variant === 'gold' || variant === 'primary' || variant === 'danger' || variant === 'record' || variant === 'stop'
      ? L.text.interactive.inverse
      : isOutline
        ? D.text.primary
        : variant === 'ghost'
          ? L.text.interactive.primary.default
          : L.text.interactive.selected;
  // 비활성은 반투명(opacity 0.5)이 아니라 disabled 토큰으로 - 채움 버튼을 반투명으로 흐리면 라벨이
  // 2:1 아래로 떨어진다. 회색 채움 + 회색 라벨(4.5:1)로 상태를 말한다.
  const isInactive = disabled && !loading;
  const effectiveLabelColor = isInactive && isSizedVariant ? L.text.disabled : labelColor;

  return (
    <Pressable
      accessibilityRole="button"
      aria-disabled={disabled || loading} aria-busy={loading}
      disabled={disabled || loading}
      onPress={onPress}
      // react-native-web은 웹에서 Pressable의 style 콜백에 pressed 말고도 hovered를 실제로
      // 넘겨주지만, 이 프로젝트가 쓰는 RN 타입 선언(PressableStateCallbackType)에는 hovered가
      // 없다 - 런타임 동작은 맞고 타입 선언만 웹 확장을 안 담고 있는 경우라 여기서만 좁혀서 받는다.
      style={({ hovered: hoveredLive, pressed: pressedLive }: { pressed: boolean; hovered?: boolean }) => {
        const hovered = hoveredLive || previewState === 'hover';
        const pressed = pressedLive || previewState === 'pressed';
        const live = !disabled && !loading;
        const state = live && pressed ? 'pressed' : live && hovered ? 'hover' : null;
        return [
          styles.base,
          (variant === 'primary' || variant === 'gold') && styles.primary,
          (variant === 'primary' || variant === 'gold') && state && { backgroundColor: L.bg.interactive.primary[state] },
          variant === 'secondary' && styles.secondary,
          variant === 'secondaryFull' && styles.secondaryFull,
          (variant === 'secondary' || variant === 'secondaryFull') && state && { backgroundColor: L.bg.interactive.secondary[state] },
          variant === 'ghost' && styles.ghost,
          variant === 'ghost' && state && { backgroundColor: L.bg.interactive.selected[state] },
          variant === 'danger' && styles.danger,
          variant === 'outline' && styles.outline,
          variant === 'outline' && state && { backgroundColor: D.bg.interactive.secondary[state] },
          variant === 'record' && styles.record,
          variant === 'stop' && styles.stop,
          isSizedVariant && { minHeight: BUTTON_HEIGHT[resolvedSize] },
          pressed && live && styles.pressed,
          disabled && !loading && (isSizedVariant ? styles.disabledFilled : styles.disabled),
        ];
      }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={effectiveLabelColor} />
      ) : (
        <>
          {icon ? <Text style={[styles.icon, { color: effectiveLabelColor }]}>{icon}</Text> : null}
          <Text
            style={[
              styles.label,
              { color: effectiveLabelColor },
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
  // minHeight는 BUTTON_HEIGHT[resolvedSize]가 유일한 출처다(record/stop만 자기 높이를 직접 갖는다).
  // 랜딩처럼 알약형(radius rounded). 가장 작은 sm(40)도 터치 영역은 minWidth로 44를 지킨다.
  base: {
    borderRadius: radius.rounded,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: space[8],
    paddingHorizontal: space[20],
    minWidth: minTouchTarget,
  },
  primary: {
    backgroundColor: L.bg.interactive.primary.default,
  },
  secondary: {
    backgroundColor: L.bg.interactive.secondary.default,
    paddingHorizontal: space[16],
  },
  secondaryFull: {
    width: '100%',
    backgroundColor: L.bg.interactive.secondary.default,
    paddingHorizontal: space[16],
  },
  ghost: {
    backgroundColor: 'transparent',
    paddingHorizontal: space[12],
  },
  danger: {
    backgroundColor: L.bg.interactive.error.default,
  },
  outline: {
    borderWidth: borderWidth[1],
    borderColor: D.border.secondary,
    backgroundColor: 'transparent',
  },
  record: {
    minHeight: 60,
    backgroundColor: L.bg.error,
  },
  stop: {
    minHeight: 56,
    backgroundColor: L.bg.error,
  },
  // press 피드백 표준 scale(0.96) - 0.95 미만은 과장돼 보인다. 색은 -pressed 토큰이 바꾼다.
  pressed: { transform: [{ scale: 0.96 }] },
  disabled: {
    opacity: 0.5,
  },
  disabledFilled: {
    backgroundColor: L.bg.disabled,
    borderWidth: borderWidth[1],
    borderColor: L.border.disabled,
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
