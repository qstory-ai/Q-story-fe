import { Pressable, StyleSheet, Text, View } from 'react-native';

import { trackLandingCta } from '@/entities/analytics';
import { BrandLockup, storybookTheme, SUPPORT_EMAIL, openSupportMail } from '@/shared/ui';

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
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={`${item.label} 섹션으로 이동`}
            onPress={() => onNavigateToSection(item.key)}
          >
            <Text style={styles.footerNavText}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.contactRow}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`문의하기, ${SUPPORT_EMAIL}로 메일 보내기`}
          style={styles.contactButton}
          onPress={() => {
            trackLandingCta('footer_contact');
            void openSupportMail('[Q-Story] 문의');
          }}
        >
          <Text style={styles.contactButtonText}>문의하기</Text>
        </Pressable>
        <Text selectable style={styles.contactEmail}>{SUPPORT_EMAIL}</Text>
      </View>
      <View style={styles.footerBottom}>
        <Text style={styles.footerBottomText}>© 2026 Q-Story. All rights reserved.</Text>
        <Text style={styles.footerBottomText}>1차 공개 베타 · 보호자와 함께 이용해 주세요.</Text>
        <Text style={styles.footerBottomText}>
          서비스를 다듬기 위해 화면 사용 기록(누른 곳·스크롤·화면 녹화)을 1년 보관해요. 입력한 글자는 가려요.
        </Text>
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
    borderTopColor: storybookTheme.color.contentPanelBorder,
    backgroundColor: storybookTheme.color.contentSurface,
  },
  footerLead: {
    color: storybookTheme.color.onContentMuted,
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
    color: storybookTheme.color.onContent,
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.medium,
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  contactButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: storybookTheme.radius.pill,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentPanelBorder,
  },
  contactButtonText: {
    color: storybookTheme.color.onContent,
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.medium,
  },
  contactEmail: {
    color: storybookTheme.color.onContentMuted,
    fontSize: storybookTheme.type.sm,
  },
  footerBottom: {
    gap: 4,
  },
  footerBottomText: {
    color: storybookTheme.color.onContentMuted,
    fontSize: storybookTheme.type.xxs,
    fontWeight: storybookTheme.type.weight.light,
  },
});
