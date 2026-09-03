import { Pressable, StyleSheet, Text } from 'react-native';

import { storybookTheme } from './theme';

/**
 * 카테고리 필터·탭 등에서 반복되던 pill 형태의 토글 컨트롤. 다크 배경 위에서만 쓴다.
 *
 * 두 tone:
 *  - `outline`: 배경 없이 테두리만. 선택 시 옅은 패널 배경 + gold 테두리. 여러 개를 나열해도
 *    시각적 무게가 가벼워 카테고리 필터처럼 다수 선택지에 적합.
 *  - `filled`: 선택 시 gold 배경 + 어두운 텍스트. 강조가 커 탭처럼 활성 상태를 뚜렷이
 *    보여줘야 하는 곳에 적합.
 *
 * LibraryPage/TutorLibraryPage가 각자 CategoryChip 컴포넌트와 tab Pressable 스타일을
 * 복제해 두던 것을 이 프리미티브로 흡수한다.
 */
export type FilterChipTone = 'outline' | 'filled';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  tone?: FilterChipTone;
  accessibilityRole?: 'button' | 'tab';
};

export function FilterChip({
  label,
  selected,
  onPress,
  tone = 'outline',
  accessibilityRole = 'button',
}: Props) {
  const containerStyle =
    tone === 'filled'
      ? [styles.base, styles.filled, selected && styles.filledActive]
      : [styles.base, styles.outline, selected && styles.outlineActive];
  const labelStyle =
    tone === 'filled'
      ? [styles.label, styles.filledLabel, selected && styles.filledLabelActive]
      : [styles.label, styles.outlineLabel, selected && styles.outlineLabelActive];
  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [...containerStyle, pressed && styles.pressed]}
    >
      <Text style={labelStyle}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: storybookTheme.radius.pill,
    borderWidth: 1,
  },
  outline: {
    paddingHorizontal: storybookTheme.spacing.ms,
    paddingVertical: 6, // spacing.xs(4)와 sm(8) 사이의 컴팩트 값 - 카테고리 chip 톤에 맞춤
    borderColor: storybookTheme.color.panelOnDarkBorder,
  },
  outlineActive: {
    backgroundColor: storybookTheme.color.panelOnDarkBackground,
    borderColor: storybookTheme.color.gold,
  },
  filled: {
    // 14/8은 filled 톤이 outline보다 살짝 크게 잡히도록 - 탭이 카테고리 chip보다 시각적으로
    // 상위 계층이라는 위계.
    paddingHorizontal: 14,
    paddingVertical: storybookTheme.spacing.sm,
    borderColor: storybookTheme.color.panelOnDarkBorder,
  },
  filledActive: {
    backgroundColor: storybookTheme.color.gold,
    borderColor: storybookTheme.color.gold,
  },
  pressed: { opacity: 0.85 },
  label: {
    fontSize: storybookTheme.type.xs,
  },
  outlineLabel: {
    fontWeight: storybookTheme.type.weight.semibold,
    color: storybookTheme.color.onDarkMuted,
  },
  outlineLabelActive: { color: storybookTheme.color.gold },
  filledLabel: {
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onDarkMuted,
  },
  filledLabelActive: { color: storybookTheme.color.background },
});
