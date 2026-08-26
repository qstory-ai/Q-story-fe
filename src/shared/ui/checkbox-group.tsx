import { StyleSheet, View } from 'react-native';

import { Checkbox } from './checkbox';
import { storybookTheme } from './theme';

export type CheckboxGroupOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type CheckboxGroupProps = {
  options: CheckboxGroupOption[];
  value: string[];
  onChange: (value: string[]) => void;
};

/** 여러 체크박스를 세로로 묶어 다중 선택을 관리한다 - Figma "Checkbox Group". */
export function CheckboxGroup({ options, value, onChange }: CheckboxGroupProps) {
  return (
    <View style={styles.group}>
      {options.map((option) => (
        <Checkbox
          key={option.value}
          label={option.label}
          description={option.description}
          disabled={option.disabled}
          checked={value.includes(option.value)}
          onChange={(checked) =>
            onChange(checked ? [...value, option.value] : value.filter((v) => v !== option.value))
          }
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: storybookTheme.spacing.ms },
});
