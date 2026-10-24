import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { TextField, storybookTheme } from '@/shared/ui';

import { OTHER_CHOICE } from '../model/use-completion-survey';

/**
 * 설문 문항 한 칸 - 왼쪽에 번호 동그라미, 오른쪽에 질문과 답. 문항마다 칸을 나눠(10/24 QA: 문항 구분이 안 됨) 번호로
 * 어디까지 왔는지 보이게 한다.
 */
export function QuestionBlock({
  number,
  label,
  hint,
  errorText,
  children,
}: {
  number: number;
  label: string;
  /** 질문 아래 작은 안내(예: "모두 골라 주세요", "선택"). */
  hint?: string;
  errorText?: string;
  children: ReactNode;
}) {
  // 휴대폰 세로는 칸 안쪽 여백을 줄여 답 칸 폭을 넓힌다.
  const narrow = useWindowDimensions().width < 480;
  return (
    <View style={[styles.block, narrow && styles.blockNarrow, errorText ? styles.blockError : null]}>
      <View style={styles.numberBadge}>
        <Text style={styles.numberText}>{number}</Text>
      </View>
      <View style={styles.blockBody}>
        <View style={styles.labelGroup}>
          <Text style={styles.label}>{label}</Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        </View>
        {children}
        {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
      </View>
    </View>
  );
}

// 선택지가 이보다 길면 칩 대신 한 줄씩 고르는 목록으로 - 긴 문장 칩이 줄바꿈되며 뒤섞여 안 읽혔다.
const LIST_OPTION_LENGTH = 12;
const useList = (options: string[]) => options.some((option) => option.length > LIST_OPTION_LENGTH);
// 이보다 짧은 선택지만 있으면 두 줄 배치 - 긴 문장을 반 폭에 넣으면 줄바꿈돼 오히려 안 읽힌다.
const GRID_OPTION_LENGTH = 20;

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      aria-selected={selected}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipActive]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function OptionRow({
  label,
  selected,
  multiple,
  grid,
  onPress,
}: {
  label: string;
  selected: boolean;
  multiple: boolean;
  grid: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      aria-checked={selected}
      onPress={onPress}
      style={[styles.row, grid && styles.rowInGrid, selected && styles.rowActive]}
    >
      <View style={[multiple ? styles.checkbox : styles.radio, selected && styles.markActive]}>
        {selected ? <View style={multiple ? styles.checkboxDot : styles.radioDot} /> : null}
      </View>
      <Text style={[styles.rowText, selected && styles.rowTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Options({
  options,
  isSelected,
  onPress,
  multiple,
}: {
  options: string[];
  isSelected: (option: string) => boolean;
  onPress: (option: string) => void;
  multiple: boolean;
}) {
  if (useList(options)) {
    const grid = options.length > 4 && options.every((option) => option.length <= GRID_OPTION_LENGTH);
    return (
      <View style={[styles.rowList, grid && styles.rowGrid]}>
        {options.map((option) => (
          <OptionRow
            grid={grid}
            key={option}
            label={option}
            selected={isSelected(option)}
            multiple={multiple}
            onPress={() => onPress(option)}
          />
        ))}
      </View>
    );
  }
  return (
    <View style={styles.chipRow}>
      {options.map((option) => (
        <Chip key={option} label={option} selected={isSelected(option)} onPress={() => onPress(option)} />
      ))}
    </View>
  );
}

type ChoiceProps = {
  number: number;
  label: string;
  options: string[];
  allowOther?: boolean;
  otherValue?: string;
  onOtherChange?: (value: string) => void;
  errorText?: string;
};

/** 단일 선택 질문 - "기타"를 허용하면 선택 시 바로 아래에 자유 입력란을 보여준다. */
export function SingleChoiceQuestion({
  number,
  label,
  options,
  value,
  onChange,
  allowOther,
  otherValue,
  onOtherChange,
  errorText,
}: ChoiceProps & { value: string; onChange: (value: string) => void }) {
  const all = allowOther ? [...options, OTHER_CHOICE] : options;
  return (
    <QuestionBlock number={number} label={label} errorText={errorText}>
      <Options options={all} isSelected={(option) => value === option} onPress={onChange} multiple={false} />
      {allowOther && value === OTHER_CHOICE ? (
        <TextField label="직접 입력" value={otherValue ?? ''} onChangeText={onOtherChange} placeholder="자유롭게 적어주세요" />
      ) : null}
    </QuestionBlock>
  );
}

/** 다중 선택(체크박스) 질문 - "기타"를 허용하면 선택 시 바로 아래에 자유 입력란을 보여준다. */
export function MultiChoiceQuestion({
  number,
  label,
  options,
  values,
  onToggle,
  allowOther,
  otherValue,
  onOtherChange,
  errorText,
}: ChoiceProps & { values: string[]; onToggle: (option: string) => void }) {
  const all = allowOther ? [...options, OTHER_CHOICE] : options;
  return (
    <QuestionBlock number={number} label={label} hint="해당하는 것을 모두 골라 주세요" errorText={errorText}>
      <Options options={all} isSelected={(option) => values.includes(option)} onPress={onToggle} multiple />
      {allowOther && values.includes(OTHER_CHOICE) ? (
        <TextField label="직접 입력" value={otherValue ?? ''} onChangeText={onOtherChange} placeholder="자유롭게 적어주세요" />
      ) : null}
    </QuestionBlock>
  );
}

/** 1~5점 척도 질문 - 양 끝에만 라벨을 붙인다(Google Form의 Linear Scale과 동일). */
export function ScaleQuestion({
  number,
  label,
  minLabel,
  maxLabel,
  value,
  onChange,
  errorText,
}: {
  number: number;
  label: string;
  minLabel: string;
  maxLabel: string;
  value: number | null;
  onChange: (value: number) => void;
  errorText?: string;
}) {
  return (
    <QuestionBlock number={number} label={label} errorText={errorText}>
      <View style={styles.scaleRow}>
        {[1, 2, 3, 4, 5].map((score) => (
          <Pressable
            key={score}
            accessibilityRole="button"
            aria-selected={value === score}
            onPress={() => onChange(score)}
            style={[styles.scaleDot, value === score && styles.scaleDotActive]}
          >
            <Text style={[styles.scaleDotText, value === score && styles.scaleDotTextActive]}>{score}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.scaleCaptionRow}>
        <Text style={styles.scaleCaption}>{minLabel}</Text>
        <Text style={[styles.scaleCaption, styles.scaleCaptionEnd]}>{maxLabel}</Text>
      </View>
    </QuestionBlock>
  );
}

/** 글로 적는 질문(모두 선택 항목). */
export function TextQuestion({
  number,
  label,
  value,
  onChange,
  placeholder,
}: {
  number: number;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <QuestionBlock number={number} label={label} hint="선택">
      <TextField label="" accessibilityLabel={label} value={value} onChangeText={onChange} placeholder={placeholder} />
    </QuestionBlock>
  );
}

const c = storybookTheme.color;
const s = storybookTheme.spacing;

const styles = StyleSheet.create({
  block: {
    flexDirection: 'row',
    gap: s.ms,
    paddingVertical: 14,
    paddingHorizontal: s.md,
    borderRadius: 18,
    backgroundColor: c.surfaceWhite,
    borderWidth: 1,
    borderColor: c.lightCardBorder,
  },
  blockNarrow: { paddingHorizontal: 12, gap: 10 },
  blockError: { borderColor: c.error },
  numberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: { fontSize: storybookTheme.type.sm, fontWeight: storybookTheme.type.weight.bold, color: c.primary },
  blockBody: { flex: 1, minWidth: 0, gap: 10 },
  labelGroup: { gap: 2, paddingTop: 3 },
  label: {
    fontSize: storybookTheme.type.md,
    lineHeight: 23,
    fontWeight: storybookTheme.type.weight.bold,
    color: c.onLightHeading,
  },
  hint: { fontSize: storybookTheme.type.xs, color: c.onLightMuted },
  errorText: { fontSize: storybookTheme.type.xs, color: c.error },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: s.sm },
  chip: {
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: c.surfaceWhite,
    borderWidth: 1,
    borderColor: c.lightCardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s.md,
  },
  chipActive: { backgroundColor: c.primary, borderColor: c.primary },
  chipText: { fontSize: storybookTheme.type.sm, fontWeight: storybookTheme.type.weight.semibold, color: c.onLightHeading },
  chipTextActive: { color: c.surfaceWhite },
  rowList: { gap: 6 },
  // 짧은 선택지가 많으면 넓은 카드에서 두 줄로(한 칸 최소 240) - 8개짜리 문항이 한 줄씩이면 너무 길었다. 좁은 화면은 한 줄.
  rowGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  rowInGrid: { flexGrow: 1, flexBasis: 240 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.ms,
    minHeight: 42,
    paddingHorizontal: s.ms,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.lightCardBorder,
  },
  rowActive: { borderColor: c.primary, backgroundColor: c.accentSoft },
  rowText: { flex: 1, fontSize: storybookTheme.type.sm, lineHeight: 20, color: c.onLightBody },
  rowTextActive: { color: c.onLightHeading, fontWeight: storybookTheme.type.weight.semibold },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: c.lightCardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: c.lightCardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDot: { width: 10, height: 10, borderRadius: 2, backgroundColor: c.primary },
  markActive: { borderColor: c.primary },
  scaleRow: { flexDirection: 'row', gap: s.sm },
  scaleDot: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: c.surfaceWhite,
    borderWidth: 1,
    borderColor: c.lightCardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleDotActive: { backgroundColor: c.primary, borderColor: c.primary },
  scaleDotText: { fontSize: storybookTheme.type.md, fontWeight: storybookTheme.type.weight.bold, color: c.onLightHeading },
  scaleDotTextActive: { color: c.surfaceWhite },
  scaleCaptionRow: { flexDirection: 'row', justifyContent: 'space-between', gap: s.sm },
  scaleCaption: { flex: 1, fontSize: storybookTheme.type.xs, color: c.onLightMuted },
  scaleCaptionEnd: { textAlign: 'right' },
});
