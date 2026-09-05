import type { RefObject } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Icon, storybookTheme } from '@/shared/ui';

import { assignSectionRef } from '../../lib/section-ref';
import { EXPERIENCE_STEPS, EXPERIENCE_SUPPORT } from '../../model/content';
import { sectionStyles } from '../section-styles';

type ExperienceSectionProps = {
  isWide: boolean;
  sectionRef: RefObject<HTMLElement | null>;
};

export function ExperienceSection({ isWide, sectionRef }: ExperienceSectionProps) {
  return (
    <View
      style={sectionStyles.section}
      ref={assignSectionRef(sectionRef)}
    >
      <View style={styles.sectionHeadingCenter}>
        <Text style={sectionStyles.eyebrow}>Q-Story란</Text>
        <Text style={sectionStyles.sectionTitle} accessibilityRole="header">보기만 하던 동화에서,{'\n'}아이가 참여하는 이야기로</Text>
        <Text style={sectionStyles.sectionSubLead}>함께 듣다가 아이의 생각을 들려주면, 그 말이 장면 속 행동으로 이어집니다.</Text>
      </View>

      <View style={[styles.stepsRow, !isWide && styles.stepsRowStacked]}>
        {EXPERIENCE_STEPS.map((step, index) => (
          <View key={step.key} style={[styles.stepCard, step.featured && styles.stepCardFeatured]}>
            <Text style={styles.stepNumber}>
              {String(index + 1).padStart(2, '0')} · {step.key}
            </Text>
            <Icon name={step.icon} size={22} color={storybookTheme.color.primary} />
            <Text style={styles.stepTitle}>{step.title}</Text>
            <Text style={styles.stepBody}>{step.body}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.supportRow, !isWide && styles.supportRowStacked]}>
        {EXPERIENCE_SUPPORT.map((item) => (
          <View key={item.label} style={styles.supportChip}>
            <Icon name={item.icon} size={16} color={storybookTheme.color.gold} />
            <Text style={styles.supportChipText}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeadingCenter: {
    gap: 10,
    alignItems: 'center',
  },
  stepsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  stepsRowStacked: {
    flexDirection: 'column',
  },
  stepCard: {
    flex: 1,
    gap: 8,
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentSurfaceBorder,
    backgroundColor: storybookTheme.color.surfaceCard,
    padding: 20,
  },
  stepCardFeatured: {
    borderColor: storybookTheme.color.gold,
    borderWidth: 2,
  },
  stepNumber: {
    color: storybookTheme.color.onCardMuted,
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.semibold,
    letterSpacing: 0.4,
  },
  stepTitle: {
    color: storybookTheme.color.onCardTitle,
    fontSize: storybookTheme.type.md,
    lineHeight: storybookTheme.type.md * storybookTheme.lineHeight.normal,
    fontWeight: storybookTheme.type.weight.semibold,
  },
  stepBody: {
    color: storybookTheme.color.onCardBody,
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    fontWeight: storybookTheme.type.weight.light,
  },
  supportRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  supportRowStacked: {
    flexDirection: 'column',
  },
  supportChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: storybookTheme.radius.pill,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentPanelBorder,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  supportChipText: {
    color: storybookTheme.color.onContentMuted,
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.regular,
  },
});
