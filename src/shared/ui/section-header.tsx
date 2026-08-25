import { StyleSheet, Text, View } from 'react-native';

import { storybookTheme } from './theme';

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
};

/** 어두운 스토리북 테마 페이지(홈 서재 등)에서 카드 그리드/목록 위에 붙는 레이블. */
export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  title: {
    color: storybookTheme.color.onDark,
    fontSize: storybookTheme.type.lg,
    fontWeight: '600',
  },
  subtitle: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.sm,
    fontWeight: '300',
  },
});
