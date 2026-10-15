import { Pressable, StyleSheet, Text, View } from 'react-native';

import { storybookTheme } from './theme';
import { borderWidth, minTouchTarget, radius, semanticColors, space } from './tokens';

const L = semanticColors.light;

/**
 * 카테고리 필터·탭 등에 쓰는 pill 형태의 토글 컨트롤(라이트 배경용).
 *
 * 두 tone:
 *  - `outline`: 배경 없이 테두리만. 선택 시 옅은 pill 배경 + primary 테두리. 여러 개를 나열해도
 *    시각적 무게가 가벼워 카테고리 필터처럼 다수 선택지에 적합.
 *  - `filled`: 선택 시 primary(Purple 500) 채움 + 흰 텍스트. 탭처럼 활성 상태를 뚜렷이 보여줘야
 *    하는 곳에 적합.
 */
export type FilterChipTone = 'outline' | 'filled';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  tone?: FilterChipTone;
  accessibilityRole?: 'button' | 'tab';
  /** 라벨 옆에 붙는 개수 뱃지 - 예: 서재 탭이 각 탭에 몇 개 있는지 미리 보여줄 때. 0은 렌더링 안 함. */
  count?: number;
};

export function FilterChip({
  label,
  selected,
  onPress,
  tone = 'outline',
  accessibilityRole = 'button',
  count,
}: Props) {
  const containerStyle =
    tone === 'filled'
      ? [styles.base, styles.filled, selected && styles.filledActive]
      : [styles.base, styles.outline, selected && styles.outlineActive];
  const labelStyle =
    tone === 'filled'
      ? [styles.label, styles.filledLabel, selected && styles.filledLabelActive]
      : [styles.label, styles.outlineLabel, selected && styles.outlineLabelActive];
  // 활성 상태의 뱃지 배경/글자색은 라벨 색과 대비되도록 자동 조정 - 톤/선택 여부의 4가지 조합.
  // container/text 스타일을 분리해 백그라운드/컬러가 각자 올바른 노드에만 적용되도록 한다.
  const badgeBg =
    tone === 'filled'
      ? selected ? styles.badgeBgFilledActive : styles.badgeBgFilledIdle
      : selected ? styles.badgeBgOutlineActive : styles.badgeBgOutlineIdle;
  const badgeFg =
    tone === 'filled'
      ? selected ? styles.badgeFgFilledActive : styles.badgeFgFilledIdle
      : selected ? styles.badgeFgOutlineActive : styles.badgeFgOutlineIdle;
  return (
    // 바깥 Pressable은 투명한 터치 영역(44px) - 위아래 padding만큼 음수 margin을 줘서 칩 줄의 레이아웃 높이는 예전(30~34) 그대로.
    // (react-native-web Pressable은 hitSlop을 무시한다.)
    <Pressable
      accessibilityRole={accessibilityRole}
      aria-selected={selected}
      onPress={onPress}
      style={[styles.hit, tone === 'filled' ? styles.hitFilled : styles.hitOutline]}
    >
      {({ pressed }) => (
        <View style={[...containerStyle, styles.row, pressed && styles.pressed]}>
          <Text style={labelStyle}>{label}</Text>
          {count != null && count > 0 ? (
            <View style={[styles.badge, badgeBg]}>
              <Text style={[styles.badgeText, badgeFg]}>{count}</Text>
            </View>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.rounded,
    borderWidth: borderWidth[1],
    justifyContent: 'center',
  },
  hit: { justifyContent: 'center' },
  /** 보이는 칩 높이 약 30 → 위아래 7씩 늘려 터치 44(minTouchTarget). */
  hitOutline: { paddingVertical: (minTouchTarget - 30) / 2, marginVertical: -(minTouchTarget - 30) / 2 },
  /** 보이는 칩 높이 약 34 → 위아래 5씩. */
  hitFilled: { paddingVertical: (minTouchTarget - 34) / 2, marginVertical: -(minTouchTarget - 34) / 2 },
  outline: {
    paddingHorizontal: space[12],
    paddingVertical: 6,
    borderColor: L.border.secondary,
    backgroundColor: L.bg.primary,
  },
  outlineActive: {
    backgroundColor: L.bg.brandSubtle,
    borderColor: L.border.interactive.primary.default,
  },
  filled: {
    paddingHorizontal: 14,
    paddingVertical: space[8],
    borderColor: L.border.secondary,
    backgroundColor: L.bg.primary,
  },
  filledActive: {
    backgroundColor: L.bg.interactive.primary.default,
    borderColor: L.bg.interactive.primary.default,
  },
  // press 피드백 표준 scale(0.96).
  pressed: { opacity: 0.9, transform: [{ scale: 0.96 }] },
  label: {
    fontSize: storybookTheme.type.xs,
  },
  outlineLabel: {
    fontWeight: storybookTheme.type.weight.semibold,
    color: L.text.secondary,
  },
  outlineLabelActive: { color: L.text.interactive.selected },
  filledLabel: {
    fontWeight: storybookTheme.type.weight.bold,
    color: L.text.secondary,
  },
  filledLabelActive: { color: L.text.interactive.inverse },
  // 라벨과 뱃지를 나란히 놓기 위한 행 컨테이너 - 기본 pill에도 flexDirection이 필요.
  row: { flexDirection: 'row', alignItems: 'center', gap: storybookTheme.spacing.xs },
  badge: {
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: storybookTheme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: storybookTheme.type.xxs,
    fontWeight: storybookTheme.type.weight.bold,
  },
  // 뱃지 4가지 조합.
  badgeBgOutlineIdle: { backgroundColor: L.bg.tertiary },
  badgeFgOutlineIdle: { color: L.text.secondary },
  badgeBgOutlineActive: { backgroundColor: L.bg.primary },
  badgeFgOutlineActive: { color: L.text.interactive.selected },
  badgeBgFilledIdle: { backgroundColor: L.bg.tertiary },
  badgeFgFilledIdle: { color: L.text.secondary },
  // primary 채움 chip 위 → 배지는 밝은 카드 톤으로 대비.
  badgeBgFilledActive: { backgroundColor: storybookTheme.color.onDarkOverlay },
  badgeFgFilledActive: { color: L.text.interactive.inverse },
});
