import { StyleSheet } from 'react-native';

import { radius, semanticColors, shadow, storybookTheme } from '@/shared/ui';

/** 반 관리 카드들이 함께 쓰는 모양 - 보호자 화면과 같은 흰 카드(radius 24, 옅은 테두리·그림자). */
export const lifecycleStyles = StyleSheet.create({
  card: {
    borderRadius: radius[24],
    backgroundColor: semanticColors.light.bg.primary,
    borderWidth: 1,
    borderColor: semanticColors.light.border.secondary,
    ...shadow(1),
    padding: storybookTheme.spacing.ml,
    gap: storybookTheme.spacing.sm,
  },
  sectionTitle: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  body: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onCardBody,
  },
  muted: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onCardMuted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: storybookTheme.spacing.sm },
  divider: {
    gap: storybookTheme.spacing.sm,
    paddingTop: storybookTheme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.pillBorder,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: storybookTheme.spacing.sm,
    paddingVertical: storybookTheme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.pillBorder,
  },
  rowTitle: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  flex: { flex: 1, gap: 2 },
  pressed: { opacity: 0.85 },
  chevron: { fontSize: storybookTheme.type.lg, color: storybookTheme.color.onCardMuted, paddingHorizontal: 4 },
  label: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardBody,
  },
});
