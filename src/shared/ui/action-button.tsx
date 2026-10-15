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
  // 터치 영역 44px 이상 - 가장 작은 버튼도 44.
  sm: 44,
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
};

export type ActionButtonState = 'default' | 'hover' | 'pressed' | 'disabled';

/**
 * variant × 상태 → 겉모습(컨테이너 스타일·라벨 색·라벨 스타일). 순수 함수라 ActionButton과 내부 UI 키트가 같이 쓴다.
 * 비활성은 반투명(opacity 0.5)이 아니라 disabled 토큰으로 - 채움 버튼을 반투명으로 흐리면 라벨이 2:1 아래로 떨어진다.
 * 채움 variant는 회색 채움 + 테두리 + 회색 라벨(4.5:1), ghost는 투명 바탕에 회색 라벨만.
 */
export function actionButtonStyle(variant: ActionButtonVariant, state: ActionButtonState, size?: ActionButtonSize) {
  const isSizedVariant = variant !== 'record' && variant !== 'stop';
  const resolvedSize = size ?? DEFAULT_SIZE_BY_VARIANT[variant] ?? 'md';
  const active = state === 'hover' || state === 'pressed' ? state : null;
  const disabled = state === 'disabled';
  const isFilledPrimary = variant === 'primary' || variant === 'gold';
  const isSecondaryFill = variant === 'secondary' || variant === 'secondaryFull';
  const labelColor = disabled && isSizedVariant
    ? L.text.disabled
    : isFilledPrimary || variant === 'danger' || variant === 'record' || variant === 'stop'
      ? L.text.interactive.inverse
      : variant === 'outline'
        ? D.text.primary
        // secondary·ghost: 옅은 보라 바탕(hover·pressed 포함) 위 Purple 800 - 5.54:1 이상.
        : L.text.interactive.selected;
  const container = [
    styles.base,
    isFilledPrimary && styles.primary,
    isFilledPrimary && active && { backgroundColor: L.bg.interactive.primary[active] },
    variant === 'secondary' && styles.secondary,
    variant === 'secondaryFull' && styles.secondaryFull,
    isSecondaryFill && active && { backgroundColor: L.bg.interactive.secondary[active] },
    variant === 'ghost' && styles.ghost,
    variant === 'ghost' && active && { backgroundColor: L.bg.interactive.selected[active] },
    variant === 'danger' && styles.danger,
    variant === 'outline' && styles.outline,
    variant === 'outline' && active && { backgroundColor: D.bg.interactive.secondary[active] },
    variant === 'record' && styles.record,
    variant === 'stop' && styles.stop,
    isSizedVariant && { minHeight: BUTTON_HEIGHT[resolvedSize] },
    state === 'pressed' && styles.pressed,
    disabled && (!isSizedVariant ? styles.disabled : variant === 'ghost' ? styles.disabledGhost : styles.disabledFilled),
  ];
  const labelStyle = [
    styles.label,
    { color: labelColor },
    (isSecondaryFill || variant === 'ghost') && styles.labelSecondary,
  ];
  return { container, labelColor, labelStyle, iconStyle: [styles.icon, { color: labelColor }] };
}

/** 앱 전역 CTA. 색·간격·라운드는 tokens.ts Semantic만 참조한다(variant × 기본/hover/pressed/disabled). */
export function ActionButton({
  label,
  onPress,
  variant = 'primary',
  size,
  disabled = false,
  icon,
  loading = false,
}: ActionButtonProps) {
  const live = !disabled && !loading;
  // 스피너·아이콘 색은 기본 상태 라벨 색(비활성이면 비활성 색).
  const resting = actionButtonStyle(variant, disabled && !loading ? 'disabled' : 'default', size);

  return (
    <Pressable
      accessibilityRole="button"
      aria-disabled={disabled || loading} aria-busy={loading}
      disabled={disabled || loading}
      onPress={onPress}
      // react-native-web은 웹에서 Pressable의 style 콜백에 pressed 말고도 hovered를 실제로
      // 넘겨주지만, 이 프로젝트가 쓰는 RN 타입 선언(PressableStateCallbackType)에는 hovered가
      // 없다 - 런타임 동작은 맞고 타입 선언만 웹 확장을 안 담고 있는 경우라 여기서만 좁혀서 받는다.
      style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) =>
        actionButtonStyle(
          variant,
          disabled && !loading ? 'disabled' : live && pressed ? 'pressed' : live && hovered ? 'hover' : 'default',
          size,
        ).container
      }
    >
      {loading ? (
        <ActivityIndicator size="small" color={resting.labelColor} />
      ) : (
        <>
          {icon ? <Text style={resting.iconStyle}>{icon}</Text> : null}
          <Text style={resting.labelStyle}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // minHeight는 BUTTON_HEIGHT[resolvedSize]가 유일한 출처다(record/stop만 자기 높이를 직접 갖는다).
  // 랜딩처럼 알약형(radius rounded). 높이는 BUTTON_HEIGHT(최소 44), 폭도 minWidth 44.
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
  disabledGhost: {
    backgroundColor: 'transparent',
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
