import { Pressable, StyleSheet, Text, View } from 'react-native';

import { storybookTheme } from './theme';

type RadioProps = {
  selected: boolean;
  onSelect: () => void;
  label: string;
  /** 라벨 아래 보조 설명 한 줄 - Figma "Radio Field"의 Description Row. */
  description?: string;
  disabled?: boolean;
};

/** 단일 라디오 옵션 - 실제 상태는 그룹(RadioGroup)이 갖고, 이 컴포넌트는 그 값을 반영만 한다
 * (Figma 주석: "Checked/Unchecked는 디자인 파일에서만 쓰는 속성이고, 코드에서는 라디오 필드를
 * 그룹으로 묶어 그 값으로 상태를 나타낸다"). */
export function Radio({ selected, onSelect, label, description, disabled }: RadioProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      onPress={() => !disabled && onSelect()}
      style={styles.row}
      hitSlop={4}
    >
      <View
        style={[
          styles.circle,
          selected && styles.circleSelected,
          disabled && (selected ? styles.circleSelectedDisabled : styles.circleDisabled),
        ]}
      >
        {selected ? <View style={[styles.dot, disabled && styles.dotDisabled]} /> : null}
      </View>
      <View style={styles.textColumn}>
        <Text style={[styles.label, disabled && styles.labelDisabled]}>{label}</Text>
        {description ? (
          <Text style={[styles.description, disabled && styles.labelDisabled]}>{description}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
  },
  circle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: storybookTheme.color.lightCardBorder,
    backgroundColor: storybookTheme.color.surfaceWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleSelected: { borderColor: storybookTheme.color.primary },
  circleDisabled: {
    borderColor: storybookTheme.color.disabledBorder,
    backgroundColor: storybookTheme.color.disabledBackground,
  },
  circleSelectedDisabled: {
    borderColor: storybookTheme.color.disabledBorder,
    backgroundColor: storybookTheme.color.disabledBackground,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: storybookTheme.color.primary,
  },
  dotDisabled: { backgroundColor: storybookTheme.color.disabledText },
  textColumn: { flex: 1, gap: 2 },
  label: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.medium,
    color: storybookTheme.color.onLightBody,
  },
  labelDisabled: { color: storybookTheme.color.disabledText },
  description: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onLightMuted,
  },
});
