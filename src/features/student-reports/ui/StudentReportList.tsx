import { Pressable, StyleSheet, Text, View } from 'react-native';

import { storybookTheme } from '@/shared/ui';

export type StudentReportRow = {
  id: string;
  title: string;
  /** "10월 3일 오후 3:00 · 12분 · 반 수업" 처럼 화면이 만든 한 줄. */
  meta: string;
};

/**
 * 학생 상세의 "리포트" 목록 - 줄을 누르면 리포트 상세(/reports/:id)로 간다. 선생님·관리자 학생 상세가 같이 쓴다.
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
          <View style={styles.body}>
            <Text style={styles.title}>{row.title}</Text>
            <Text style={styles.meta}>{row.meta}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 2 },
  empty: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onCardMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.pillBorder,
  },
  pressed: { opacity: 0.85 },
  body: { flex: 1, gap: 2 },
  title: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  meta: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onCardMuted },
  chevron: { fontSize: storybookTheme.type.lg, color: storybookTheme.color.onCardMuted, paddingHorizontal: 4 },
});
