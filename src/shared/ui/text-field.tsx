import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

import { FieldDescription, FieldError, FieldLabel, fieldBackgroundColor, fieldBorderColor, fieldTextColor } from './field-primitives';
import { storybookTheme } from './theme';

type TextFieldProps = TextInputProps & {
  label: string;
  description?: string;
  errorText?: string;
};

/** 라벨/설명/에러 텍스트가 딸린 한 줄 입력 필드. */
export function TextField({ label, description, errorText, style, editable, accessibilityLabel, onFocus, onBlur, ...rest }: TextFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const isDisabled = editable === false;
  const state = isDisabled ? 'disabled' : errorText ? 'error' : 'default';
  return (
    <View style={styles.container}>
      <FieldLabel disabled={isDisabled}>{label}</FieldLabel>
      {description ? <FieldDescription disabled={isDisabled}>{description}</FieldDescription> : null}
      <TextInput
        style={[
          styles.input,
          { borderColor: fieldBorderColor(state, isFocused), backgroundColor: fieldBackgroundColor(state), color: fieldTextColor(state) },
          style,
        ]}
        placeholderTextColor={isDisabled ? storybookTheme.color.disabledText : storybookTheme.color.onLightMuted}
        autoCapitalize="none"
        autoCorrect={false}
        editable={editable}
        accessibilityLabel={accessibilityLabel ?? label}
        {...rest}
        onFocus={(event) => {
          setIsFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setIsFocused(false);
          onBlur?.(event);
        }}
      />
      {errorText ? <FieldError>{errorText}</FieldError> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  input: {
    minHeight: 52,
    borderRadius: storybookTheme.radius.input,
    borderWidth: 1,
    paddingHorizontal: storybookTheme.spacing.ml,
    /** md(16)로 반올림 - 15px 미만 입력창은 모바일 사파리에서 포커스 시 자동 확대(zoom)를 유발한다. */
    fontSize: storybookTheme.type.md,
  },
});
