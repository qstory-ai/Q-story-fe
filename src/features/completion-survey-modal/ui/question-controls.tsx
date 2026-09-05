import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TextField, storybookTheme } from '@/shared/ui';

function QuestionLabel({ label, errorText }: { label: string; errorText?: string }) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.label}>{label}</Text>
      {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipActive]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

/** 단일 선택 질문 - "기타"를 허용하면 선택 시 바로 아래에 자유 입력란을 보여준다. */
export function SingleChoiceQuestion({
  label,
  options,
  value,
  onChange,
  allowOther,
  otherValue,
  onOtherChange,
  errorText,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  allowOther?: boolean;
  otherValue?: string;
  onOtherChange?: (value: string) => void;
  errorText?: string;
}) {
  const isOtherSelected = allowOther && value === '기타';
  return (
    <View style={styles.field}>
      <QuestionLabel label={label} errorText={errorText} />
      <View style={styles.chipRow}>
        {options.map((option) => (
          <Chip
            key={option}
            label={option}
            selected={value === option}
            onPress={() => onChange(option)}
          />
        ))}
        {allowOther ? (
          <Chip label="기타" selected={!!isOtherSelected} onPress={() => onChange('기타')} />
        ) : null}
      </View>
      {isOtherSelected ? (
        <TextField
          label="직접 입력"
          value={otherValue ?? ''}
          onChangeText={onOtherChange}
          placeholder="자유롭게 적어주세요"
        />
      ) : null}
    </View>
  );
}

/** 다중 선택(체크박스) 질문 - "기타"를 허용하면 선택 시 바로 아래에 자유 입력란을 보여준다. */
export function MultiChoiceQuestion({
  label,
  options,
  values,
  onToggle,
  allowOther,
  otherValue,
  onOtherChange,
  errorText,
}: {
  label: string;
  options: string[];
  values: string[];
  onToggle: (option: string) => void;
  allowOther?: boolean;
  otherValue?: string;
  onOtherChange?: (value: string) => void;
  errorText?: string;
}) {
  const isOtherSelected = allowOther && values.includes('기타');
  return (
    <View style={styles.field}>
      <QuestionLabel label={label} errorText={errorText} />
      <View style={styles.chipRow}>
        {options.map((option) => (
          <Chip
            key={option}
            label={option}
            selected={values.includes(option)}
            onPress={() => onToggle(option)}
          />
        ))}
        {allowOther ? (
          <Chip label="기타" selected={!!isOtherSelected} onPress={() => onToggle('기타')} />
        ) : null}
      </View>
      {isOtherSelected ? (
        <TextField
          label="직접 입력"
          value={otherValue ?? ''}
          onChangeText={onOtherChange}
          placeholder="자유롭게 적어주세요"
        />
      ) : null}
    </View>
  );
}

/** 1~5점 척도 질문 - 양 끝에만 라벨을 붙인다(Google Form의 Linear Scale과 동일). */
export function ScaleQuestion({
  label,
  minLabel,
  maxLabel,
  value,
  onChange,
  errorText,
}: {
  label: string;
  minLabel: string;
  maxLabel: string;
  value: number | null;
  onChange: (value: number) => void;
  errorText?: string;
}) {
  return (
    <View style={styles.field}>
      <QuestionLabel label={label} errorText={errorText} />
      <View style={styles.scaleRow}>
        {[1, 2, 3, 4, 5].map((score) => (
          <Pressable
            key={score}
            accessibilityRole="button"
            accessibilityState={{ selected: value === score }}
            onPress={() => onChange(score)}
            style={[styles.scaleDot, value === score && styles.scaleDotActive]}
          >
            <Text style={[styles.scaleDotText, value === score && styles.scaleDotTextActive]}>
              {score}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.scaleCaptionRow}>
        <Text style={styles.scaleCaption}>{minLabel}</Text>
        <Text style={styles.scaleCaption}>{maxLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: storybookTheme.spacing.sm,
  },
  labelRow: {
    gap: storybookTheme.spacing.xs,
  },
  label: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.medium,
    color: storybookTheme.color.onLightHeading,
  },
  errorText: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.error,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: storybookTheme.spacing.sm,
  },
  chip: {
    minHeight: 44,
    borderRadius: storybookTheme.radius.input,
    backgroundColor: storybookTheme.color.disabledBackground,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: storybookTheme.spacing.ms,
    paddingVertical: storybookTheme.spacing.sm,
  },
  chipActive: {
    backgroundColor: storybookTheme.color.primary,
    borderColor: storybookTheme.color.primary,
  },
  chipText: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.semibold,
    color: storybookTheme.color.onLightHeading,
  },
  chipTextActive: {
    color: storybookTheme.color.surfaceWhite,
  },
  scaleRow: {
    flexDirection: 'row',
    gap: storybookTheme.spacing.sm,
  },
  scaleDot: {
    flex: 1,
    minHeight: 44,
    borderRadius: storybookTheme.radius.input,
    backgroundColor: storybookTheme.color.disabledBackground,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleDotActive: {
    backgroundColor: storybookTheme.color.primary,
    borderColor: storybookTheme.color.primary,
  },
  scaleDotText: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onLightHeading,
  },
  scaleDotTextActive: {
    color: storybookTheme.color.surfaceWhite,
  },
  scaleCaptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scaleCaption: {
    fontSize: storybookTheme.type.xxs,
    color: storybookTheme.color.onLightMuted,
    maxWidth: '48%',
  },
});
