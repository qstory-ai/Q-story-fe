import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

import { storybookTheme } from './theme';

type TextFieldProps = TextInputProps & {
  label: string;
  errorText?: string;
};

/** 이 코드베이스에서 첫 번째 폼 입력 프리미티브 - 로그인/회원가입 폼이 이것을 필요로 하는 첫 기능이다. */
export function TextField({ label, errorText, style, accessibilityLabel, ...rest }: TextFieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, errorText ? styles.inputError : null, style]}
        placeholderTextColor={storybookTheme.color.onLightMuted}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={accessibilityLabel ?? label}
        {...rest}
      />
      {errorText ? (
        <Text style={styles.errorText} accessibilityLiveRegion="polite">
          {errorText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.medium,
    color: storybookTheme.color.onLightBody,
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: storybookTheme.color.lightCardBorder,
    backgroundColor: storybookTheme.color.surfaceWhite,
    paddingHorizontal: 14,
    /** md(16)로 반올림 - 15px 미만 입력창은 모바일 사파리에서 포커스 시 자동 확대(zoom)를 유발한다. */
    fontSize: storybookTheme.type.md,
    color: storybookTheme.color.onCardTitle,
  },
  inputError: {
    borderColor: storybookTheme.color.error,
  },
  errorText: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.error,
  },
});
