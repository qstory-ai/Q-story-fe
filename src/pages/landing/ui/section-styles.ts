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
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  sectionTitle: {
    color: storybookTheme.color.onDark,
    fontSize: storybookTheme.type.xxl,
    lineHeight: 36,
    fontWeight: '700',
  },
  sectionSubLead: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.md,
    lineHeight: storybookTheme.type.md * storybookTheme.lineHeight.normal,
    fontWeight: '300',
  },
  buttonGoldLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 56,
    borderRadius: 17,
    backgroundColor: storybookTheme.color.gold,
    paddingHorizontal: 24,
  },
  buttonGoldLargeText: {
    color: storybookTheme.color.primary,
    fontSize: storybookTheme.type.md,
    fontWeight: '700',
  },
});
