import { Pressable, StyleSheet, Text, View } from 'react-native';

import { storybookTheme } from './theme';

type SwitchFieldProps = {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

/** 라벨/설명이 딸린 토글 스위치 - Figma "Switch Field". */
export function SwitchField({ label, description, checked, onChange, disabled }: SwitchFieldProps) {
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked, disabled }}
        onPress={() => !disabled && onChange(!checked)}
        style={styles.row}
        hitSlop={4}
      >
        <Text style={[styles.label, disabled && styles.labelDisabled]}>{label}</Text>
        <View
          style={[
            styles.track,
            checked && styles.trackChecked,
            disabled && (checked ? styles.trackCheckedDisabled : styles.trackDisabled),
          ]}
        >
          <View
            style={[
              styles.thumb,
              { left: checked ? 18 : 2, transitionProperty: 'left', transitionDuration: '150ms', transitionTimingFunction: 'ease-out' } as never,
              disabled && styles.thumbDisabled,
            ]}
          />
        </View>
      </Pressable>
      {description ? <Text style={[styles.description, disabled && styles.labelDisabled]}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: storybookTheme.spacing.ms,
    minHeight: 44,
  },
  label: {
    flex: 1,
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.medium,
    color: storybookTheme.color.onLightBody,
  },
  labelDisabled: { color: storybookTheme.color.disabledText },
  description: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onLightMuted,
  },
  track: {
    width: 40,
    height: 24,
    borderRadius: storybookTheme.radius.pill,
    backgroundColor: storybookTheme.color.lightCardBorder,
    justifyContent: 'center',
  },
  trackChecked: { backgroundColor: storybookTheme.color.primary },
  trackDisabled: { backgroundColor: storybookTheme.color.disabledBackground },
  trackCheckedDisabled: { backgroundColor: storybookTheme.color.disabledBorder },
  thumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: storybookTheme.color.surfaceWhite,
  },
  thumbDisabled: { backgroundColor: storybookTheme.color.disabledText },
});
