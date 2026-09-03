import { StyleSheet } from 'react-native';

import { storybookTheme } from '@/shared/ui';

/**
 * 여러 랜딩 섹션이 공유하는 스타일 키만 모아둔다. 특정 섹션 하나만 쓰는 키는
 * 각 섹션 파일(ui/sections/*.tsx)의 StyleSheet.create에 그대로 둔다.
 */
export const sectionStyles = StyleSheet.create({
  pressed: {
    opacity: 0.85,
  },
  section: {
    width: '100%',
    maxWidth: storybookTheme.layout.wideMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
    gap: 24,
  },
  eyebrow: {
    color: storybookTheme.color.gold,
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.semibold,
    letterSpacing: 0.4,
  },
  sectionTitle: {
    color: storybookTheme.color.onDark,
    fontSize: storybookTheme.type.xxl,
    // xxl(32) * tight(1.2) = 38.4보다 살짝 좁은 헤딩 라인 - 히어로 톤에 맞춘 값이라 유지.
    lineHeight: 36,
    fontWeight: storybookTheme.type.weight.bold,
  },
  sectionSubLead: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.md,
    lineHeight: storybookTheme.type.md * storybookTheme.lineHeight.normal,
    fontWeight: storybookTheme.type.weight.light,
  },
  buttonGoldLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: storybookTheme.spacing.sm,
    minHeight: 56,
    borderRadius: storybookTheme.radius.button,
    backgroundColor: storybookTheme.color.gold,
    paddingHorizontal: storybookTheme.spacing.lg,
  },
  buttonGoldLargeText: {
    color: storybookTheme.color.primary,
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.bold,
  },
});
