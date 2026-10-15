import { StyleSheet, Text, View } from 'react-native';

import { FILTER_CHIP_ROW_GAP, FilterChip, storybookTheme } from '@/shared/ui';

import { LESSON_PLAY_SETTINGS, PLAY_SETTING_LABELS, type PlaySetting } from '../model/types';

/** 반 수업 진행 형태(Q-40) - 개별 / 소그룹 / 전체 반. 고른 값은 플레이어 주소의 setting=으로 회차 기록에 남는다. */
export function LessonPlaySettingPicker({
  value,
  onChange,
  align = 'center',
}: {
  value: PlaySetting;
  onChange: (next: PlaySetting) => void;
  /** 모달 안은 가운데, 카드 안은 왼쪽 정렬. */
  align?: 'center' | 'start';
}) {
  return (
    <View style={[styles.wrap, align === 'start' && styles.wrapStart]} accessibilityRole="radiogroup" accessibilityLabel="수업 진행 형태">
      <Text style={styles.label}>진행 형태</Text>
      <View style={[styles.row, align === 'start' && styles.rowStart]}>
        {LESSON_PLAY_SETTINGS.map((setting) => (
          <FilterChip
            key={setting}
            tone="filled"
            label={PLAY_SETTING_LABELS[setting]}
            selected={value === setting}
            onPress={() => onChange(setting)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: storybookTheme.spacing.sm, alignItems: 'center' },
  wrapStart: { alignItems: 'flex-start' },
  label: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardBody,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: storybookTheme.spacing.sm, rowGap: FILTER_CHIP_ROW_GAP }, // 칩이 여러 줄로 감길 때 터치 영역(44)이 겹치지 않게
  rowStart: { justifyContent: 'flex-start' },
});
