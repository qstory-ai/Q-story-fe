import { Pressable, StyleSheet, Text, View } from 'react-native';

import { storybookTheme } from './theme';
import { minTouchTarget, semanticColors, space } from './tokens';

const L = semanticColors.light;

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  /** 오른쪽 끝 낮은 위계 링크("더 보기"). 터치 영역 44px. */
  action?: { label: string; onPress: () => void };
};

/** 카드 그리드/목록 위에 붙는 섹션 제목(+ 보조 문장, 오른쪽 링크). */
export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.container}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action ? (
        <Pressable
          accessibilityRole="button"
          onPress={action.onPress}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <Text style={styles.actionLabel}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space[12],
  },
  container: {
    flex: 1,
    gap: space[4],
  },
  title: {
    color: L.text.primary,
    fontSize: storybookTheme.type.lg,
    lineHeight: storybookTheme.type.lg * storybookTheme.lineHeight.tight,
    letterSpacing: storybookTheme.type.lg * storybookTheme.tracking.heading,
    fontWeight: storybookTheme.type.weight.semibold,
  },
  subtitle: {
    color: L.text.tertiary,
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.regular,
  },
  action: {
    minHeight: minTouchTarget,
    minWidth: minTouchTarget,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  actionPressed: { opacity: 0.7 },
  actionLabel: {
    color: L.text.interactive.selected,
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
  },
});
