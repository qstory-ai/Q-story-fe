import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, radius, semanticColors, shadow, storybookTheme } from '@/shared/ui';

export type StudentReportRow = {
  id: string;
  title: string;
  /** "10월 3일 오후 3:00 · 12분 · 반 수업" 처럼 화면이 만든 한 줄. */
  meta: string;
};

/**
 * 학생 상세의 "리포트" 목록 - 줄을 누르면 리포트 상세(/reports/:id)로 간다. 선생님·관리자 학생 상세가 같이 쓴다.
 * 줄 하나가 보호자 홈 "최근 리포트"와 같은 흰 카드 행이라 카드 안에 다시 담지 않는다.
 */
export function StudentReportList({
  rows,
  emptyMessage,
  onOpen,
}: {
  rows: StudentReportRow[];
  emptyMessage: string;
  onOpen: (completionId: string) => void;
}) {
  if (rows.length === 0) return <Text style={styles.empty}>{emptyMessage}</Text>;
  return (
    <View style={styles.list}>
      {rows.map((row) => (
        <Pressable
          key={row.id}
          accessibilityRole="link"
          accessibilityLabel={`${row.title} 리포트 열기`}
          onPress={() => onOpen(row.id)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <View style={styles.icon}>
            <Icon name="report" size={16} color={storybookTheme.color.gold} />
          </View>
          <View style={styles.body}>
            <Text style={styles.title} numberOfLines={1}>{row.title}</Text>
            <Text style={styles.meta}>{row.meta}</Text>
          </View>
          <Icon name="chevronRight" size={16} color={storybookTheme.color.onContentMuted} />
        </Pressable>
      ))}
    </View>
  );
}

const L = semanticColors.light;

const styles = StyleSheet.create({
  list: { gap: 8 },
  empty: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onContentMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: L.bg.primary,
    borderRadius: radius[16],
    borderWidth: 1,
    borderColor: L.border.secondary,
    ...shadow(1),
  },
  pressed: { opacity: 0.85 },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: L.bg.brandSubtle,
  },
  body: { flex: 1, gap: 2 },
  title: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onContent,
  },
  meta: {
    fontSize: storybookTheme.type.xs,
    lineHeight: storybookTheme.type.xs * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onContentMuted,
  },
});
