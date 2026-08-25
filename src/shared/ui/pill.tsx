import { StyleSheet, Text, View } from 'react-native';

import { storybookTheme } from './theme';

type PillProps = {
  label: string;
  tone?: 'onDark' | 'onCard';
};

/** 작고 둥근 카테고리/상태 태그 - 스토리북 홈 서재와 이야기 상세 페이지가 처음으로 공유하는 배지. */
export function Pill({ label, tone = 'onCard' }: PillProps) {
  return (
    <View style={[styles.base, tone === 'onDark' ? styles.onDark : styles.onCard]}>
      <Text style={[styles.text, tone === 'onDark' ? styles.textOnDark : styles.textOnCard]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: storybookTheme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  onCard: {
    backgroundColor: storybookTheme.color.pillBackground,
    borderColor: storybookTheme.color.pillBorder,
  },
  onDark: {
    backgroundColor: 'rgba(246, 198, 77, 0.16)',
    borderColor: 'rgba(246, 198, 77, 0.4)',
  },
  text: {
    fontSize: storybookTheme.type.xs,
    fontWeight: '600',
  },
  textOnCard: {
    color: storybookTheme.color.primary,
  },
  textOnDark: {
    color: storybookTheme.color.gold,
  },
});
