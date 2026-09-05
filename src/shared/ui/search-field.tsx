import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { fieldBackgroundColor, fieldBorderColor, fieldTextColor, type FieldState } from './field-primitives';
import { Icon } from './icon';
import { storybookTheme } from './theme';

type SearchFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
};

/** 알약형 검색 입력 - 값이 비어있으면 돋보기, 값이 있으면 지우기(X) 아이콘을 보여준다
 * (Figma "Search"). */
export function SearchField({ value, onChangeText, placeholder = '검색', disabled, accessibilityLabel }: SearchFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const state: FieldState = disabled ? 'disabled' : 'default';
  return (
    <View
      style={[styles.container, { borderColor: fieldBorderColor(state, isFocused), backgroundColor: fieldBackgroundColor(state) }]}
    >
      <TextInput
        value={value}
        onChangeText={disabled ? undefined : onChangeText}
        editable={!disabled}
        placeholder={placeholder}
        placeholderTextColor={disabled ? storybookTheme.color.disabledText : storybookTheme.color.onLightMuted}
        style={[styles.input, { color: fieldTextColor(state) }]}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      {value ? (
        <Pressable
          disabled={disabled}
          onPress={() => onChangeText('')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="검색어 지우기"
        >
          <Icon name="close" size={16} color={disabled ? storybookTheme.color.disabledText : storybookTheme.color.onLightMuted} />
        </Pressable>
      ) : (
        <Icon name="search" size={16} color={disabled ? storybookTheme.color.disabledText : storybookTheme.color.onLightMuted} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderRadius: storybookTheme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: storybookTheme.spacing.ml,
    gap: storybookTheme.spacing.sm,
  },
  input: { flex: 1, fontSize: storybookTheme.type.md, paddingVertical: 0 },
});
