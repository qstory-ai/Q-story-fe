import { Pressable, StyleSheet, Text } from 'react-native';

import { radius, semanticColors, shadow, space, storybookTheme } from '@/shared/ui';

const L = semanticColors.light;

type RoleCardProps = {
  title: string;
  description: string;
  onPress: () => void;
  /** 가로로 나란히 둘 때(넓은 화면 "/") 같은 폭으로 나눠 갖는다. */
  fill?: boolean;
};

/** 역할 카드 한 장 - "/" 비로그인 패널과 온보딩 역할 선택이 같은 모양을 쓴다. */
export function RoleCard({ title, description, onPress, fill = false }: RoleCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, fill && styles.fill, pressed && styles.pressed]}
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{description}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: L.bg.primary,
    borderWidth: 1,
    borderColor: L.border.secondary,
    borderRadius: radius[24],
    padding: space[20],
    gap: space[4],
    ...shadow(1),
  },
  fill: { flex: 1 },
  pressed: { opacity: 0.9 },
  title: {
    color: storybookTheme.color.onContent,
    fontSize: storybookTheme.type.md,
    lineHeight: storybookTheme.type.md * storybookTheme.lineHeight.normal,
    fontWeight: storybookTheme.type.weight.bold,
  },
  body: {
    color: storybookTheme.color.onContentMuted,
    fontSize: storybookTheme.type.sm,
    lineHeight: 20,
    fontWeight: storybookTheme.type.weight.light,
  },
});
