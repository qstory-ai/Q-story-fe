import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandLockup, storybookTheme } from '@/shared/ui';

import { NAV_SECTIONS, type SectionKey } from '../../model/content';

type FooterSectionProps = {
  onNavigateToSection: (key: SectionKey) => void;
};

export function FooterSection({ onNavigateToSection }: FooterSectionProps) {
  return (
    <View style={styles.footer}>
      <BrandLockup size="compact" />
      <Text style={styles.footerLead}>아이의 질문을 달라지는 중간 장면으로 이어 주는 AI 인터랙티브 동화</Text>
      <View style={styles.footerNav}>
        {NAV_SECTIONS.map((item) => (
          <Pressable key={item.key} onPress={() => onNavigateToSection(item.key)}>
            <Text style={styles.footerNavText}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.footerBottom}>
        <Text style={styles.footerBottomText}>© 2026 Q-Story. All rights reserved.</Text>
        <Text style={styles.footerBottomText}>1차 공개 베타 · 보호자와 함께 이용해 주세요.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    width: '100%',
    maxWidth: storybookTheme.layout.wideMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  footerLead: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    fontWeight: storybookTheme.type.weight.light,
  },
  footerNav: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  footerNavText: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.medium,
  },
  footerBottom: {
    gap: 4,
  },
  footerBottomText: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.xxs,
    fontWeight: storybookTheme.type.weight.light,
  },
});
