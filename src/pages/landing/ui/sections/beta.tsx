import type { RefObject } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, storybookTheme } from '@/shared/ui';

import { assignSectionRef } from '../../lib/section-ref';
import { BETA_QUICK_FACTS, BETA_SHOWCASE_ILLUSTRATION } from '../../model/content';
import { sectionStyles } from '../section-styles';

type BetaSectionProps = {
  isWide: boolean;
  sectionRef: RefObject<HTMLElement | null>;
  onGoToDemo: () => void;
};

export function BetaSection({ isWide, sectionRef, onGoToDemo }: BetaSectionProps) {
  return (
    <View
      style={[sectionStyles.section, isWide && styles.betaSectionWide]}
      ref={assignSectionRef(sectionRef)}
    >
      <View style={[styles.betaCopy, isWide && styles.betaCopyWide]}>
        <Text style={sectionStyles.eyebrow}>Q-Story 1차 공개 베타</Text>
        <Text style={sectionStyles.sectionTitle}>아이와 한 편을 완주하고,{'\n'}느낀 점을 들려주세요.</Text>
        <Text style={sectionStyles.sectionSubLead}>
          「헨젤과 그레텔」을 무료로 체험하고, 완주 뒤 1분 후기로 솔직한 경험을 나눠 주세요.
        </Text>

        <View style={styles.quickFactList}>
          {BETA_QUICK_FACTS.map((fact) => (
            <View key={fact.title} style={styles.quickFactRow}>
              <Icon name={fact.icon} size={16} color={storybookTheme.color.gold} />
              <Text style={styles.quickFactText}>
                <Text style={styles.quickFactStrong}>{fact.title}</Text> {fact.body}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.betaFeedbackRow}>
          <Icon name="sparkles" size={15} color={storybookTheme.color.gold} />
          <Text style={styles.betaFeedbackText}>여러분의 1분 후기가 다음 동화와 체험 방식을 결정하는 데 쓰여요.</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={onGoToDemo}
          style={({ pressed }) => [styles.buttonVioletFull, pressed && sectionStyles.pressed]}
        >
          <Text style={styles.buttonVioletFullText}>무료로 한 편 체험하기</Text>
          <Icon name="next" size={18} color={storybookTheme.color.onDark} />
        </Pressable>
        <Text style={styles.betaNote}>무료 · 회원가입 없음 · 질문하지 않아도 결말까지 감상 가능</Text>
      </View>

      <View style={[styles.betaShowcase, isWide && styles.betaShowcaseWide]}>
        <View style={styles.betaStoryFrame}>
          <Image
            source={{ uri: BETA_SHOWCASE_ILLUSTRATION.uri }}
            resizeMode="cover"
            style={styles.betaStoryFrameImage}
            accessibilityLabel={BETA_SHOWCASE_ILLUSTRATION.label}
          />
          <View style={styles.betaStoryFrameCaption}>
            <Text style={styles.betaStoryFrameCaptionKicker}>체험 화면</Text>
            <Text style={styles.betaStoryFrameCaptionText}>아이의 질문으로 이어진 밤의 대화</Text>
          </View>
        </View>
        <View style={styles.reportPreview}>
          <View style={styles.reportPreviewHeader}>
            <View style={styles.reportPreviewIcon}>
              <Icon name="report" size={16} color={storybookTheme.color.primary} />
            </View>
            <Text style={styles.reportPreviewHeaderLabel}>부모 리포트 미리보기</Text>
            <View style={styles.reportBadge}>
              <Text style={styles.reportBadgeText}>완주 후</Text>
            </View>
          </View>
          <Text style={styles.reportPreviewTitle}>오늘 아이는{'\n'}먼저 살펴보는 방법을 제안했어요.</Text>
          <Text style={styles.reportPreviewQuote}>“창문부터 살펴보자!”</Text>
          <Text style={styles.reportPreviewBody}>
            아이의 질문과 실제로 달라진 장면을 한눈에 확인하고, 대화를 이어갈 질문도 받아보세요.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  betaSectionWide: {
    flexDirection: 'row',
    gap: 40,
  },
  betaCopy: {
    gap: 14,
  },
  betaCopyWide: {
    flex: 1,
  },
  quickFactList: {
    gap: 10,
    marginTop: 4,
  },
  quickFactRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  quickFactText: {
    flex: 1,
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.sm,
    lineHeight: 20,
    fontWeight: '300',
  },
  quickFactStrong: {
    color: storybookTheme.color.onDark,
    fontWeight: '600',
  },
  betaFeedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  betaFeedbackText: {
    flex: 1,
    color: storybookTheme.color.gold,
    fontSize: storybookTheme.type.sm,
    lineHeight: 20,
    fontWeight: '500',
  },
  buttonVioletFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 56,
    width: '100%',
    borderRadius: 17,
    backgroundColor: storybookTheme.color.primary,
    paddingHorizontal: 24,
    marginTop: 4,
  },
  buttonVioletFullText: {
    color: storybookTheme.color.onDark,
    fontSize: storybookTheme.type.md,
    fontWeight: '700',
  },
  betaNote: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.xs,
    fontWeight: '400',
  },
  betaShowcase: {
    gap: 16,
    marginTop: 8,
  },
  betaShowcaseWide: {
    flex: 1,
    marginTop: 0,
  },
  betaStoryFrame: {
    borderRadius: storybookTheme.radius.card,
    overflow: 'hidden',
    backgroundColor: storybookTheme.color.coverFallback,
    ...storybookTheme.elevation.low,
  },
  betaStoryFrameImage: {
    width: '100%',
    aspectRatio: 5 / 3,
  },
  betaStoryFrameCaption: {
    backgroundColor: 'rgba(18, 10, 30, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  betaStoryFrameCaptionKicker: {
    color: storybookTheme.color.gold,
    fontSize: storybookTheme.type.xxs,
    fontWeight: '600',
  },
  betaStoryFrameCaptionText: {
    color: storybookTheme.color.onDark,
    fontSize: storybookTheme.type.sm,
    fontWeight: '400',
  },
  reportPreview: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    padding: 20,
    gap: 10,
  },
  reportPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reportPreviewIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: storybookTheme.color.pillBackground,
  },
  reportPreviewHeaderLabel: {
    flex: 1,
    color: storybookTheme.color.onCardMuted,
    fontSize: storybookTheme.type.xs,
    fontWeight: '500',
  },
  reportBadge: {
    borderRadius: storybookTheme.radius.pill,
    backgroundColor: storybookTheme.color.pillBackground,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  reportBadgeText: {
    color: storybookTheme.color.primary,
    fontSize: storybookTheme.type.xxs,
    fontWeight: '600',
  },
  reportPreviewTitle: {
    color: storybookTheme.color.onCardTitle,
    fontSize: storybookTheme.type.lg,
    lineHeight: storybookTheme.type.lg * storybookTheme.lineHeight.tight,
    letterSpacing: storybookTheme.type.lg * storybookTheme.tracking.heading,
    fontWeight: '600',
  },
  reportPreviewQuote: {
    color: storybookTheme.color.primary,
    fontSize: storybookTheme.type.md,
    lineHeight: storybookTheme.type.md * storybookTheme.lineHeight.normal,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  reportPreviewBody: {
    color: storybookTheme.color.onCardBody,
    fontSize: storybookTheme.type.sm,
    lineHeight: 20,
    fontWeight: '300',
  },
});
