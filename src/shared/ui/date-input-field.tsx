import { useRef } from 'react';
import type { ElementRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { FieldDescription, FieldError, FieldLabel, fieldBackgroundColor, fieldBorderColor, fieldTextColor, type FieldState } from './field-primitives';
import { storybookTheme } from './theme';

type DateInputFieldProps = {
  label: string;
  description?: string;
  errorText?: string;
  day: string;
  month: string;
  year: string;
  onChangeDay: (value: string) => void;
  onChangeMonth: (value: string) => void;
  onChangeYear: (value: string) => void;
  disabled?: boolean;
};

/** DD/MM/YYYY 세 칸으로 나뉜 날짜 입력 - Figma "Date Input Field". 자리수를 다 채우면 다음
 * 칸으로 포커스를 자동으로 넘긴다. */
export function DateInputField({
  label,
  description,
  errorText,
  day,
  month,
  year,
  onChangeDay,
  onChangeMonth,
  onChangeYear,
  disabled,
}: DateInputFieldProps) {
  const monthRef = useRef<ElementRef<typeof TextInput>>(null);
  const yearRef = useRef<ElementRef<typeof TextInput>>(null);
  const state: FieldState = disabled ? 'disabled' : errorText ? 'error' : 'default';
  const segmentColors = {
    borderColor: fieldBorderColor(state),
    backgroundColor: fieldBackgroundColor(state),
    color: fieldTextColor(state),
  };
  const placeholderColor = disabled ? storybookTheme.color.disabledText : storybookTheme.color.onLightMuted;

  return (
    <View style={styles.container}>
      <FieldLabel disabled={disabled}>{label}</FieldLabel>
      {description ? <FieldDescription disabled={disabled}>{description}</FieldDescription> : null}
      <View style={styles.row}>
        <TextInput
          value={day}
          onChangeText={(text) => {
            const digits = text.replace(/\D/g, '').slice(0, 2);
            onChangeDay(digits);
            if (digits.length === 2) monthRef.current?.focus();
          }}
          placeholder="DD"
          placeholderTextColor={placeholderColor}
          keyboardType="number-pad"
          maxLength={2}
          editable={!disabled}
          style={[styles.segment, segmentColors]}
          accessibilityLabel={`${label} 일`}
        />
        <TextInput
          ref={monthRef}
          value={month}
          onChangeText={(text) => {
            const digits = text.replace(/\D/g, '').slice(0, 2);
            onChangeMonth(digits);
            if (digits.length === 2) yearRef.current?.focus();
          }}
          placeholder="MM"
          placeholderTextColor={placeholderColor}
          keyboardType="number-pad"
          maxLength={2}
          editable={!disabled}
          style={[styles.segment, segmentColors]}
          accessibilityLabel={`${label} 월`}
        />
        <TextInput
          ref={yearRef}
          value={year}
          onChangeText={(text) => onChangeYear(text.replace(/\D/g, '').slice(0, 4))}
          placeholder="YYYY"
          placeholderTextColor={placeholderColor}
          keyboardType="number-pad"
          maxLength={4}
          editable={!disabled}
          style={[styles.segment, segmentColors]}
          accessibilityLabel={`${label} 연도`}
        />
      </View>
      {errorText ? <FieldError>{errorText}</FieldError> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  row: { flexDirection: 'row', gap: storybookTheme.spacing.sm },
  segment: {
    flex: 1,
    minHeight: 48,
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    paddingHorizontal: storybookTheme.spacing.md,
    fontSize: storybookTheme.type.md,
  },
});
