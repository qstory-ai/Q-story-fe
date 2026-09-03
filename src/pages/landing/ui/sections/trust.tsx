import type { RefObject } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Icon, storybookTheme } from '@/shared/ui';

import { assignSectionRef } from '../../lib/section-ref';
import { TRUST_PILLARS } from '../../model/content';
import { sectionStyles } from '../section-styles';

type TrustSectionProps = {
  isWide: boolean;
  sectionRef: RefObject<HTMLElement | null>;
};

export function TrustSection({ isWide, sectionRef }: TrustSectionProps) {
  return (
    <View
      style={[sectionStyles.section, isWide && styles.trustSectionWide]}
      ref={assignSectionRef(sectionRef)}
    >
      <View style={[styles.trustCopy, isWide && styles.trustCopyWide]}>
        <Text style={sectionStyles.eyebrow}>부모가 안심할 수 있도록</Text>
        <Text style={sectionStyles.sectionTitle}>자유롭게 말해도,{'\n'}이야기는 안전하게 이어져요.</Text>
        <Text style={sectionStyles.sectionSubLead}>
          Q-Story는 자유 대화 챗봇이 아닙니다. 현재 장면과 미리 검수한 범위 안에서만 아이의 말을 반영하고, 중요한 사건과
          결말은 지킵니다.
        </Text>
        <View style={styles.parentNote}>
          <Text style={styles.parentNoteKicker}>보호자에게</Text>
          <Text style={styles.parentNoteTitle}>완벽한 문장이 아니어도 괜찮아요.</Text>
          <Text style={styles.parentNoteBody}>조금 기다려 주고 “어떤 점이 궁금했어?”라고 한 번 더 물어봐 주세요.</Text>
        </View>
      </View>

      <View style={[styles.trustPillars, isWide && styles.trustPillarsWide]}>
        {TRUST_PILLARS.map((pillar) => (
          <View key={pillar.title} style={styles.pillarRow}>
            <View style={styles.pillarIcon}>
              <Icon name={pillar.icon} size={18} color={storybookTheme.color.primary} />
            </View>
            <View style={styles.pillarTextGroup}>
              <Text style={styles.pillarTitle}>{pillar.title}</Text>
              <Text style={styles.pillarBody}>{pillar.body}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  trustSectionWide: {
    flexDirection: 'row',
    gap: 40,
  },
  trustCopy: {
    gap: 16,
  },
  trustCopyWide: {
    flex: 1,
  },
  parentNote: {
    marginTop: 8,
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    padding: 18,
    gap: 4,
  },
  parentNoteKicker: {
    color: storybookTheme.color.primary,
    fontSize: storybookTheme.type.xxs,
    fontWeight: storybookTheme.type.weight.semibold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  parentNoteTitle: {
    color: storybookTheme.color.onCardTitle,
    fontSize: storybookTheme.type.md,
    lineHeight: storybookTheme.type.md * storybookTheme.lineHeight.normal,
    fontWeight: storybookTheme.type.weight.semibold,
  },
  parentNoteBody: {
    color: storybookTheme.color.onCardBody,
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    fontWeight: storybookTheme.type.weight.light,
  },
  trustPillars: {
    gap: 16,
    marginTop: 8,
  },
  trustPillarsWide: {
    flex: 1,
    marginTop: 0,
    justifyContent: 'center',
  },
  pillarRow: {
    flexDirection: 'row',
    gap: 14,
  },
  pillarIcon: {
    width: 40,
    height: 40,
    borderRadius: storybookTheme.radius.input,
    alignItems: 'center',
    justifyContent: 'center',
    // 골드 강조 배경 - CTA/highlight 전용이라 아직 토큰화하지 않고 유지.
    backgroundColor: 'rgba(246, 198, 77, 0.16)',
  },
  pillarTextGroup: {
    flex: 1,
    gap: 2,
  },
  pillarTitle: {
    color: storybookTheme.color.onDark,
    fontSize: storybookTheme.type.md,
    lineHeight: storybookTheme.type.md * storybookTheme.lineHeight.normal,
    fontWeight: storybookTheme.type.weight.semibold,
  },
  pillarBody: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    fontWeight: storybookTheme.type.weight.light,
  },
});
