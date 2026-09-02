import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, Pill, storybookTheme } from '@/shared/ui';

import { HERO_ILLUSTRATION } from '../../model/content';
import { sectionStyles } from '../section-styles';

type HeroSectionProps = {
  isWide: boolean;
  onGoToDemo: () => void;
  onExploreExperience: () => void;
};

export function HeroSection({ isWide, onGoToDemo, onExploreExperience }: HeroSectionProps) {
  return (
    <View style={[sectionStyles.section, isWide && styles.heroSectionWide]}>
      <View style={[styles.heroCopy, isWide && styles.heroCopyWide]}>
        <Pill label="6–9세 아이와 부모가 함께하는 AI 동화" tone="onDark" />
        <Text style={styles.heroTitle}>
          아이의 질문과 선택으로,{'\n'}중간 장면이 달라져요.
        </Text>
        <Text style={styles.heroLead}>
          아이의 질문·추측·제안이 동화 속 행동으로 이어집니다. 중요한 사건과 결말은 안전하게 이어져요.
        </Text>
        <View style={styles.heroActions}>
          <Pressable
            accessibilityRole="button"
            onPress={onGoToDemo}
            style={({ pressed }) => [sectionStyles.buttonGoldLarge, pressed && sectionStyles.pressed]}
          >
            <Text style={sectionStyles.buttonGoldLargeText}>무료로 한 편 체험하기</Text>
            <Icon name="next" size={18} color={storybookTheme.color.primary} />
          </Pressable>
          <Pressable accessibilityRole="link" onPress={onExploreExperience}>
            <Text style={styles.textLink}>Q-Story 체험 방식 보기</Text>
          </Pressable>
        </View>
        <View style={styles.heroFacts}>
          {['무료 · 회원가입 없음', '질문 방식에 따라 체험 시간 달라짐', '말·글 모두 가능'].map((fact) => (
            <View key={fact} style={styles.heroFactRow}>
              <Icon name="check" size={15} color={storybookTheme.color.gold} />
              <Text style={styles.heroFactText}>{fact}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.heroVisual, isWide && styles.heroVisualWide]}>
        <View style={styles.storybook}>
          <Image
            source={{ uri: HERO_ILLUSTRATION.uri }}
            resizeMode="cover"
            style={styles.storybookImage}
            accessibilityLabel={HERO_ILLUSTRATION.label}
          />
          <View style={styles.storybookCaption}>
            <Text style={styles.speaker}>그레텔</Text>
            <Text style={styles.storybookCaptionText}>이 집, 바로 들어가도 괜찮을까? 네 생각을 들려줄래?</Text>
          </View>
        </View>
        <View style={styles.questionBubble}>
          <Icon name="mic" size={14} color={storybookTheme.color.gold} />
          <Text style={styles.questionBubbleText}>“창문부터 살펴보자!”</Text>
        </View>
        <View style={styles.changeNote}>
          <Icon name="sparkles" size={14} color={storybookTheme.color.primary} />
          <Text style={styles.changeNoteText}>질문과 선택으로 중간 장면이 달라져요</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroSectionWide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 40,
  },
  heroCopy: {
    gap: 16,
  },
  heroCopyWide: {
    flex: 1,
  },
  heroTitle: {
    color: storybookTheme.color.onDark,
    fontSize: storybookTheme.type.xxl,
    lineHeight: 42, // lineHeight preserved
    fontWeight: storybookTheme.type.weight.bold,
  },
  heroLead: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.md,
    lineHeight: storybookTheme.type.md * storybookTheme.lineHeight.normal,
    fontWeight: storybookTheme.type.weight.light,
  },
  heroActions: {
    gap: 12,
    marginTop: 4,
    alignItems: 'flex-start',
  },
  textLink: {
    color: storybookTheme.color.onDark,
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.medium,
    textDecorationLine: 'underline',
  },
  heroFacts: {
    gap: 8,
    marginTop: 4,
  },
  heroFactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroFactText: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.regular,
  },
  heroVisual: {
    marginTop: 32,
    gap: -12,
  },
  heroVisualWide: {
    flex: 1,
    marginTop: 0,
  },
  storybook: {
    borderRadius: storybookTheme.radius.card,
    overflow: 'hidden',
    backgroundColor: storybookTheme.color.coverFallback,
    ...storybookTheme.elevation.high,
  },
  storybookImage: {
    width: '100%',
    aspectRatio: 5 / 3,
  },
  storybookCaption: {
    backgroundColor: storybookTheme.color.surfaceCard,
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 4,
  },
  speaker: {
    color: storybookTheme.color.primary,
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    letterSpacing: 0.4,
  },
  storybookCaptionText: {
    color: storybookTheme.color.onCardTitle,
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    fontWeight: storybookTheme.type.weight.regular,
  },
  questionBubble: {
    alignSelf: 'flex-end',
    marginRight: 16,
    marginTop: -18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: storybookTheme.color.onCardTitle,
    borderRadius: storybookTheme.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(246, 198, 77, 0.4)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    ...storybookTheme.elevation.low,
  },
  questionBubbleText: {
    color: storybookTheme.color.onDark,
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.medium,
  },
  changeNote: {
    alignSelf: 'center',
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: storybookTheme.color.gold,
    borderRadius: storybookTheme.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    ...storybookTheme.elevation.low,
  },
  changeNoteText: {
    color: storybookTheme.color.primary,
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.semibold,
  },
});
