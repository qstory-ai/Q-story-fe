import { StyleSheet, View } from 'react-native';

import { Radio } from './radio';
import { storybookTheme } from './theme';

export type RadioGroupOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type RadioGroupProps = {
  options: RadioGroupOption[];
  value: string | null;
  onChange: (value: string) => void;
  /** 그룹 전체를 스크린리더에서 하나의 라디오 묶음으로 알리는 라벨. */
  accessibilityLabel?: string;
};

/** 여러 라디오를 세로로 묶어 단일 선택을 관리한다 - Figma "Radio Group". */
export function RadioGroup({ options, value, onChange, accessibilityLabel }: RadioGroupProps) {
  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => (
        <Radio
          key={option.value}
          label={option.label}
          description={option.description}
          disabled={option.disabled}
          selected={value === option.value}
          onSelect={() => onChange(option.value)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: storybookTheme.spacing.ms },
});
