import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { storybookTheme } from '@/shared/ui';
import { birthYearOptions, formatBirthYear } from '../model/age-band';

type Props = {
  value: number | null;
  onChange: (birthYear: number) => void;
  label?: string;
  /** 표시할 출생연도 범위(나이 기준). 기본 4~12세. 선생님 학생 등록은 6~9세로 좁힌다. */
  minAge?: number;
  maxAge?: number;
  /** 칩 색을 그리는 배경 - 밝은 시트(카드) 위인지, 앱 셸(콘텐츠) 위인지. */
  tone?: 'card' | 'content';
};

/**
 * "~년생" 선택 칩. 나이를 직접 고르게 하지 않고 출생연도를 받아 나이는 계산한다(연 나이 = 올해 -
 * 출생연도, 서버 ChildAge와 같은 규칙). 부모 아이 프로필(AddChildModal·온보딩), 선생님 학생 등록,
 * 수업 폼의 학생 바로 등록이 같은 컴포넌트를 쓴다.
 */
export function BirthYearChips({ value, onChange, label = '출생연도', minAge = 4, maxAge = 12, tone = 'card' }: Props) {
  const options = birthYearOptions(minAge, maxAge);
  return (
    <View style={styles.group}>
      <Text style={[styles.groupLabel, tone === 'content' && styles.groupLabelContent]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {options.map((year) => {
          const selected = year === value;
          return (
            <Pressable
              key={year}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={formatBirthYear(year)}
              onPress={() => onChange(year)}
              style={({ pressed }) => [
                styles.chip,
                tone === 'content' && styles.chipContent,
                selected && styles.chipSelected,
                pressed && styles.chipPressed,
              ]}
            >
              <Text style={[styles.chipLabel, tone === 'content' && styles.chipLabelContent, selected && styles.chipLabelSelected]}>
                {formatBirthYear(year)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  groupLabel: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardBody,
  },
  groupLabelContent: { color: storybookTheme.color.onLightHeading },
  chipRow: { gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: storybookTheme.radius.pill,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    backgroundColor: 'transparent',
  },
  chipContent: { borderColor: storybookTheme.color.contentPanelBorder, backgroundColor: storybookTheme.color.contentSurface },
  chipSelected: {
    backgroundColor: storybookTheme.color.primary,
    borderColor: storybookTheme.color.primary,
  },
  chipPressed: { opacity: 0.85 },
  chipLabel: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardBody,
  },
  chipLabelContent: { color: storybookTheme.color.onContentMuted },
  chipLabelSelected: { color: storybookTheme.color.onContent },
});
