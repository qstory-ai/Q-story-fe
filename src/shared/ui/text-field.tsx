import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

type TextFieldProps = TextInputProps & {
  label: string;
  errorText?: string;
};

/** First form-input primitive in this codebase - login/signup forms are the first feature needing one. */
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
    fontWeight: '700',
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
