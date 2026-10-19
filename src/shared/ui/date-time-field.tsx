import { useState, type CSSProperties } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FieldDescription, FieldError, FieldLabel, fieldBackgroundColor, fieldBorderColor, fieldFocusRing, fieldTextColor, type FieldState } from './field-primitives';
import { storybookTheme } from './theme';

type DateTimeFieldProps = {
  label: string;
  description?: string;
  errorText?: string;
  /** "YYYY-MM-DD" - 비어 있으면 미정. */
  date: string;
  /** "HH:MM" - withTime일 때만 쓴다. */
  time?: string;
  /** false면 날짜만 고른다(예: 종료 날짜). */
  withTime?: boolean;
  onChange: (next: { date: string; time: string }) => void;
  /** 비워 둘 수 있는 필드면 값이 있을 때 "지우기"를 보여 준다. */
  onClear?: () => void;
  disabled?: boolean;
};

/**
 * 날짜(+시각) 입력 - 브라우저의 기본 날짜·시각 선택기(`<input type="date">`/`type="time"`)를 그대로 쓴다.
 * 웹 전용 앱(Capacitor도 WebView)이라 RN TextInput 대신 DOM input을 직접 그리고, 테두리·포커스 링은
 * TextField와 같은 field-primitives 값을 쓴다. 값은 입력 그대로 "YYYY-MM-DD" / "HH:MM" 문자열이다.
 */
export function DateTimeField({
  label,
  description,
  errorText,
  date,
  time = '',
  withTime = true,
  onChange,
  onClear,
  disabled,
}: DateTimeFieldProps) {
  const state: FieldState = disabled ? 'disabled' : errorText ? 'error' : 'default';
  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <FieldLabel disabled={disabled}>{label}</FieldLabel>
        {onClear && date && !disabled ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`${label} 지우기`} hitSlop={8} onPress={onClear}>
            <Text style={styles.clear}>지우기</Text>
          </Pressable>
        ) : null}
      </View>
      {description ? <FieldDescription disabled={disabled}>{description}</FieldDescription> : null}
      <View style={styles.row}>
        <View style={styles.dateCell}>
          <NativeInput
            type="date"
            ariaLabel={withTime ? `${label} 날짜` : label}
            value={date}
            state={state}
            disabled={disabled}
            onChange={(next) => onChange({ date: next, time })}
          />
        </View>
        {withTime ? (
          <View style={styles.timeCell}>
            <NativeInput
              type="time"
              ariaLabel={`${label} 시각`}
              value={time}
              state={state}
              disabled={disabled}
              onChange={(next) => onChange({ date, time: next })}
            />
          </View>
        ) : null}
      </View>
      {errorText ? <FieldError>{errorText}</FieldError> : null}
    </View>
  );
}

function NativeInput({
  type,
  ariaLabel,
  value,
  state,
  disabled,
  onChange,
}: {
  type: 'date' | 'time';
  ariaLabel: string;
  value: string;
  state: FieldState;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const style: CSSProperties = {
    ...inputBaseStyle,
    borderColor: fieldBorderColor(state, focused),
    backgroundColor: fieldBackgroundColor(state),
    color: fieldTextColor(state),
    ...(focused && state === 'default' ? fieldFocusRing : null),
  };
  return (
    <input
      type={type}
      // global.css outline 대신 컴포넌트 포커스 링(fieldFocusRing)을 쓴다.
      data-field-ring="true"
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={style}
    />
  );
}

const inputBaseStyle: CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  minHeight: 52,
  borderRadius: storybookTheme.radius.input,
  borderWidth: 1,
  borderStyle: 'solid',
  paddingLeft: storybookTheme.spacing.ml,
  paddingRight: storybookTheme.spacing.ml,
  /** TextField와 같은 md(16) - 15px 미만이면 모바일 사파리가 포커스 시 확대한다. */
  fontSize: storybookTheme.type.md,
  fontFamily: 'inherit',
};

const styles = StyleSheet.create({
  container: { gap: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  clear: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.primary,
    textDecorationLine: 'underline',
  },
  row: { flexDirection: 'row', gap: 8 },
  dateCell: { flex: 3, minWidth: 0 },
  timeCell: { flex: 2, minWidth: 0 },
});
