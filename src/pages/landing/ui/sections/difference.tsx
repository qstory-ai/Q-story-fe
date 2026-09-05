import type { RefObject } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Icon, storybookTheme } from '@/shared/ui';

import { assignSectionRef } from '../../lib/section-ref';
import { PROOF_POINTS } from '../../model/content';
import { sectionStyles } from '../section-styles';

type DifferenceSectionProps = {
  isWide: boolean;
  sectionRef: RefObject<HTMLElement | null>;
};

export function DifferenceSection({ isWide, sectionRef }: DifferenceSectionProps) {
  return (
    <View
      style={[sectionStyles.section, isWide && styles.differenceSectionWide]}
      ref={assignSectionRef(sectionRef)}
    >
      <View style={[styles.differenceCopy, isWide && styles.differenceCopyWide]}>
        <Text style={sectionStyles.eyebrow}>아이의 말이 닿는 순간</Text>
        <Text style={sectionStyles.sectionTitle} accessibilityRole="header">
          아이의 “왜?”와{'\n'}“이렇게 해 보자”가{'\n'}장면 속 행동이 돼요.
        </Text>
        <Text style={sectionStyles.sectionSubLead}>
          질문뿐 아니라 추측, 경고, 거절, 해 보고 싶은 방법도 받아들입니다. 아이가 말한 뜻을 먼저 확인하고 가능한 변화로 보여
          줍니다.
        </Text>
        <View style={styles.proofList}>
          {PROOF_POINTS.map((point, index) => (
            <View key={point.title} style={styles.proofRow}>
              <Text style={styles.proofIndex}>{String(index + 1).padStart(2, '0')}</Text>
              <View style={styles.proofTextGroup}>
                <Text style={styles.proofTitle}>{point.title}</Text>
                <Text style={styles.proofBody}>{point.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.differenceVisual, isWide && styles.differenceVisualWide]}>
        <View style={styles.sceneCard}>
          <View style={styles.sceneLabelRow}>
            <Icon name="mic" size={15} color={storybookTheme.color.primary} />
            <Text style={styles.sceneLabel}>아이의 생각</Text>
          </View>
          <Text style={styles.sceneQuote}>“저 할머니, 조금 수상해.{'\n'}창문부터 살펴보자.”</Text>
        </View>
        <View style={styles.sceneCard}>
          <View style={styles.sceneLabelRow}>
            <Icon name="searchCheck" size={15} color={storybookTheme.color.primary} />
            <Text style={styles.sceneLabel}>이렇게 들었어요</Text>
          </View>
          <Text style={styles.sceneBody}>“들어가기 전에 창문을 먼저 살펴보자.”</Text>
        </View>
        <View style={[styles.sceneCard, styles.sceneCardResult]}>
          <View style={styles.sceneLabelRow}>
            <Icon name="sparkles" size={15} color={storybookTheme.color.gold} />
            <Text style={[styles.sceneLabel, styles.sceneLabelOnResult]}>달라진 장면</Text>
          </View>
          <Text style={styles.sceneBodyOnResult}>
            그레텔이 고개를 끄덕이고, 남매는 집에 들어가기 전 창문을 살펴봐요.
          </Text>
          <View style={styles.resultTag}>
            <Text style={styles.resultTagText}>아이의 제안을 바로 반영</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  differenceSectionWide: {
    flexDirection: 'row',
    gap: 40,
  },
  differenceCopy: {
    gap: 16,
  },
  differenceCopyWide: {
    flex: 1,
  },
  proofList: {
    gap: 14,
    marginTop: 4,
  },
  proofRow: {
    flexDirection: 'row',
    gap: 14,
  },
  proofIndex: {
    color: storybookTheme.color.gold,
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.bold,
    width: 28,
  },
  proofTextGroup: {
    flex: 1,
    gap: 2,
  },
  proofTitle: {
    color: storybookTheme.color.onContent,
    fontSize: storybookTheme.type.md,
    lineHeight: storybookTheme.type.md * storybookTheme.lineHeight.normal,
    fontWeight: storybookTheme.type.weight.semibold,
  },
  proofBody: {
    color: storybookTheme.color.onContentMuted,
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    fontWeight: storybookTheme.type.weight.light,
  },
  differenceVisual: {
    gap: 12,
    marginTop: 8,
  },
  differenceVisualWide: {
    flex: 1,
    marginTop: 0,
    justifyContent: 'center',
  },
  sceneCard: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    padding: 18,
    gap: 8,
    ...storybookTheme.elevation.low,
  },
  sceneCardResult: {
    backgroundColor: storybookTheme.color.primary,
  },
  sceneLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sceneLabel: {
    color: storybookTheme.color.primary,
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.semibold,
  },
  sceneLabelOnResult: {
    color: storybookTheme.color.gold,
  },
  sceneQuote: {
    color: storybookTheme.color.onCardTitle,
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    fontWeight: storybookTheme.type.weight.medium,
    fontStyle: 'italic',
  },
  sceneBody: {
    color: storybookTheme.color.onCardBody,
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    fontWeight: storybookTheme.type.weight.regular,
  },
  sceneBodyOnResult: {
    color: storybookTheme.color.onDark,
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    fontWeight: storybookTheme.type.weight.regular,
  },
  resultTag: {
    alignSelf: 'flex-start',
    marginTop: 4,
    borderRadius: storybookTheme.radius.pill,
    backgroundColor: 'rgba(246, 198, 77, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(246, 198, 77, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  resultTagText: {
    color: storybookTheme.color.gold,
    fontSize: storybookTheme.type.xxs,
    fontWeight: storybookTheme.type.weight.semibold,
  },
});
