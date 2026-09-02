import { StyleSheet, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

import { FieldDescription, FieldError, FieldLabel, fieldBackgroundColor, fieldBorderColor, fieldTextColor } from './field-primitives';
import { storybookTheme } from './theme';

type TextFieldProps = TextInputProps & {
  label: string;
  description?: string;
  errorText?: string;
};

/** 이 코드베이스에서 첫 번째 폼 입력 프리미티브 - 로그인/회원가입 폼이 이것을 필요로 하는 첫 기능이다. */
export function TextField({ label, description, errorText, style, editable, accessibilityLabel, ...rest }: TextFieldProps) {
  const isDisabled = editable === false;
  const state = isDisabled ? 'disabled' : errorText ? 'error' : 'default';
  return (
    <View style={styles.container}>
      <FieldLabel disabled={isDisabled}>{label}</FieldLabel>
      {description ? <FieldDescription disabled={isDisabled}>{description}</FieldDescription> : null}
      <TextInput
        style={[
          styles.input,
          { borderColor: fieldBorderColor(state), backgroundColor: fieldBackgroundColor(state), color: fieldTextColor(state) },
          style,
        ]}
        placeholderTextColor={isDisabled ? storybookTheme.color.disabledText : storybookTheme.color.onLightMuted}
        autoCapitalize="none"
        autoCorrect={false}
        editable={editable}
        accessibilityLabel={accessibilityLabel ?? label}
        {...rest}
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
    // Toss식 정돈: 입력창 높이를 52로 올려 CTA(52)와 나란히 정렬되게 하고, 라운드도 radius.input
    // 토큰(12)으로 명시. paddingHorizontal은 ml(20)로 넉넉하게.
    minHeight: 52,
    borderRadius: storybookTheme.radius.input,
    borderWidth: 1,
    paddingHorizontal: storybookTheme.spacing.ml,
    /** md(16)로 반올림 - 15px 미만 입력창은 모바일 사파리에서 포커스 시 자동 확대(zoom)를 유발한다. */
    fontSize: storybookTheme.type.md,
  },
});
