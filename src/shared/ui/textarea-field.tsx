import { StyleSheet, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

import { FieldDescription, FieldError, FieldLabel, fieldBackgroundColor, fieldBorderColor, fieldTextColor } from './field-primitives';
import { storybookTheme } from './theme';

type TextareaFieldProps = TextInputProps & {
  label: string;
  description?: string;
  errorText?: string;
};

/** 여러 줄 입력 - Figma "Textarea Field". TextField와 상태/토큰을 공유한다. */
export function TextareaField({ label, description, errorText, style, editable, accessibilityLabel, ...rest }: TextareaFieldProps) {
  const isDisabled = editable === false;
  const state = isDisabled ? 'disabled' : errorText ? 'error' : 'default';
  return (
    <View style={styles.container}>
      <FieldLabel disabled={isDisabled}>{label}</FieldLabel>
      {description ? <FieldDescription disabled={isDisabled}>{description}</FieldDescription> : null}
      <TextInput
        multiline
        textAlignVertical="top"
        style={[
          styles.textarea,
          { borderColor: fieldBorderColor(state), backgroundColor: fieldBackgroundColor(state), color: fieldTextColor(state) },
          style,
        ]}
        placeholderTextColor={isDisabled ? storybookTheme.color.disabledText : storybookTheme.color.onLightMuted}
        editable={editable}
        accessibilityLabel={accessibilityLabel ?? label}
        {...rest}
      />
      {errorText ? <FieldError>{errorText}</FieldError> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  textarea: {
    minHeight: 96,
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    paddingHorizontal: storybookTheme.spacing.md,
    paddingVertical: storybookTheme.spacing.ms,
    fontSize: storybookTheme.type.md,
  },
});
