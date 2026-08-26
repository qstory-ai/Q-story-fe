import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FieldDescription, FieldError, FieldLabel, fieldBackgroundColor, fieldBorderColor, fieldTextColor, type FieldState } from './field-primitives';
import { Icon } from './icon';
import { storybookTheme } from './theme';

type DatePickerFieldProps = {
  label: string;
  description?: string;
  errorText?: string;
  placeholder?: string;
  /** 이미 포맷된 표시용 문자열(예: "2026-08-26") - 실제 달력 UI는 이 필드가 갖지 않고,
   * onPress로 호출부가 원하는 방식(자체 달력, 네이티브 picker 등)을 연다. */
  value?: string | null;
  onPress: () => void;
  disabled?: boolean;
};

/** 값 표시 + 달력 아이콘을 가진 트리거 - Figma "Date Picker Field"(주석: "Calendar 컴포넌트와
 * 짝지어 쓴다"). 실제 달력 그리드는 이 컴포넌트의 책임이 아니라 호출부가 연결한다. */
export function DatePickerField({ label, description, errorText, placeholder = '날짜 선택', value, onPress, disabled }: DatePickerFieldProps) {
  const state: FieldState = disabled ? 'disabled' : errorText ? 'error' : 'default';
  return (
    <View style={styles.container}>
      <FieldLabel disabled={disabled}>{label}</FieldLabel>
      {description ? <FieldDescription disabled={disabled}>{description}</FieldDescription> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={onPress}
        style={[styles.trigger, { borderColor: fieldBorderColor(state), backgroundColor: fieldBackgroundColor(state) }]}
      >
        <Text
          style={[
            styles.value,
            { color: value ? fieldTextColor(state) : disabled ? storybookTheme.color.disabledText : storybookTheme.color.onLightMuted },
          ]}
        >
          {value ?? placeholder}
        </Text>
        <Icon name="calendar" size={16} color={disabled ? storybookTheme.color.disabledText : storybookTheme.color.onLightMuted} />
      </Pressable>
      {errorText ? <FieldError>{errorText}</FieldError> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
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
});
