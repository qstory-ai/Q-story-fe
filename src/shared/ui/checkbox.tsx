import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from './icon';
import { storybookTheme } from './theme';

type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
};

/** 라이트 폼 화면(가입 등)에서 쓰는 체크박스 - 반 코드 없이 가입하는 학부모 토글이 첫 사용처다. */
export function Checkbox({ checked, onChange, label }: CheckboxProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={styles.row}
      hitSlop={4}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Icon name="check" size={13} color={storybookTheme.color.onDark} /> : null}
      </View>
      <Text style={styles.label}>{label}</Text>
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
    borderRadius: 6,
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
  label: {
    flex: 1,
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.medium,
    color: storybookTheme.color.onLightBody,
  },
});
