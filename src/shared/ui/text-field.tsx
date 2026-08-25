import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

type TextFieldProps = TextInputProps & {
  label: string;
  errorText?: string;
};

/** 이 코드베이스에서 첫 번째 폼 입력 프리미티브 - 로그인/회원가입 폼이 이것을 필요로 하는 첫 기능이다. */
export function TextField({ label, errorText, style, ...rest }: TextFieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, errorText ? styles.inputError : null, style]}
        placeholderTextColor="#9C87AC"
        autoCapitalize="none"
        autoCorrect={false}
        {...rest}
      />
      {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#503267',
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0D3EA',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#2E1B3D',
  },
  inputError: {
    borderColor: '#E46647',
  },
  errorText: {
    fontSize: 12,
    color: '#E46647',
  },
});
