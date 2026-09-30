import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from './icon';
import { storybookTheme } from './theme';

type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  /** 라벨 아래 보조 설명 한 줄 - Figma "Checkbox Field"의 Description Row. */
  description?: string;
  disabled?: boolean;
};

/** 라이트 폼 화면(가입 등)에서 쓰는 체크박스 - 반 코드 없이 가입하는 학부모 토글이 첫 사용처다. */
export function Checkbox({ checked, onChange, label, description, disabled }: CheckboxProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      onPress={() => !disabled && onChange(!checked)}
      style={styles.row}
      hitSlop={4}
    >
      <View
        style={[
          styles.box,
          checked && styles.boxChecked,
          disabled && styles.boxDisabled,
        ]}
      >
        {checked ? (
          <Icon
            name="check"
            size={13}
            color={disabled ? storybookTheme.color.disabledText : storybookTheme.color.onDark}
          />
        ) : null}
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
  box: {
    width: 22,
    height: 22,
    borderRadius: storybookTheme.radius.control,
    borderWidth: 1.5,
    borderColor: storybookTheme.color.lightCardBorder,
    backgroundColor: storybookTheme.color.surfaceWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: {
    borderColor: storybookTheme.color.primary,
    backgroundColor: storybookTheme.color.primary,
  },
  boxDisabled: {
    borderColor: storybookTheme.color.disabledBorder,
    backgroundColor: storybookTheme.color.disabledBackground,
  },
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
