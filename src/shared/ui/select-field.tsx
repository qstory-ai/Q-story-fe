import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FieldDescription, FieldError, FieldLabel, fieldBackgroundColor, fieldBorderColor, fieldTextColor, type FieldState } from './field-primitives';
import { Icon } from './icon';
import { storybookTheme } from './theme';

export type SelectOption = { value: string; label: string };

type SelectFieldProps = {
  label: string;
  description?: string;
  errorText?: string;
  placeholder?: string;
  options: SelectOption[];
  value: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
};

/** 커스텀 드롭다운 - Figma "Select Field". 웹 전용 앱이라 트리거 바깥을 누르면 닫히도록
 * position:'fixed' 배경막을 쓴다(react-native-web 확장 - RN 코어에는 없는 값). */
export function SelectField({
  label,
  description,
  errorText,
  placeholder = '선택해 주세요',
  options,
  value,
  onChange,
  disabled,
}: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? null;
  const state: FieldState = disabled ? 'disabled' : errorText ? 'error' : 'default';

  return (
    <View style={styles.container}>
      <FieldLabel disabled={disabled}>{label}</FieldLabel>
      {description ? <FieldDescription disabled={disabled}>{description}</FieldDescription> : null}
      <View style={styles.anchor}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ disabled, expanded: open }}
          disabled={disabled}
          onPress={() => setOpen((v) => !v)}
          style={[
            styles.trigger,
            { borderColor: fieldBorderColor(state), backgroundColor: fieldBackgroundColor(state) },
          ]}
        >
          <Text
            style={[
              styles.value,
              { color: selected ? fieldTextColor(state) : disabled ? storybookTheme.color.disabledText : storybookTheme.color.onLightMuted },
            ]}
            numberOfLines={1}
          >
            {selected ? selected.label : placeholder}
          </Text>
          <Icon
            name="chevronDown"
            size={16}
            color={disabled ? storybookTheme.color.disabledText : storybookTheme.color.onLightMuted}
          />
        </Pressable>
        {open && !disabled ? (
          <>
            <Pressable
              accessibilityElementsHidden
              style={[StyleSheet.absoluteFill, styles.backdrop] as never}
              onPress={() => setOpen(false)}
            />
            <View style={styles.options}>
              <ScrollView style={styles.optionsScroll} bounces={false}>
                {options.map((option) => {
                  const isSelected = option.value === value;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="menuitem"
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                      style={({ pressed }) => [
                        styles.option,
                        pressed && styles.optionPressed,
                        isSelected && styles.optionSelected,
                      ]}
                    >
                      <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </>
        ) : null}
      </View>
      {errorText ? <FieldError>{errorText}</FieldError> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  anchor: { position: 'relative' },
  trigger: {
    minHeight: 48,
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    paddingHorizontal: storybookTheme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: storybookTheme.spacing.sm,
  },
  value: { flex: 1, fontSize: storybookTheme.type.md },
  backdrop: { position: 'fixed', zIndex: storybookTheme.zIndex.overlay } as never,
  options: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 6,
    maxHeight: 220,
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    borderColor: storybookTheme.color.lightCardBorder,
    backgroundColor: storybookTheme.color.surfaceWhite,
    zIndex: storybookTheme.zIndex.overlay + 1,
    ...storybookTheme.elevation.low,
  },
  optionsScroll: { borderRadius: storybookTheme.radius.card },
  option: { minHeight: 40, justifyContent: 'center', paddingHorizontal: storybookTheme.spacing.md },
  optionPressed: { backgroundColor: storybookTheme.color.pillBackground },
  optionSelected: { backgroundColor: storybookTheme.color.pillBackground },
  optionText: { fontSize: storybookTheme.type.md, color: storybookTheme.color.onCardTitle },
  optionTextSelected: { fontWeight: storybookTheme.type.weight.semibold, color: storybookTheme.color.primary },
});
