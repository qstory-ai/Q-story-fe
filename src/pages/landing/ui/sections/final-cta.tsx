import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, storybookTheme } from '@/shared/ui';

import { FINAL_CTA_ILLUSTRATION } from '../../model/content';
import { sectionStyles } from '../section-styles';

type FinalCtaSectionProps = {
  onGoToDemo: () => void;
};

export function FinalCtaSection({ onGoToDemo }: FinalCtaSectionProps) {
  return (
    <View style={styles.finalCta}>
      <Image
        source={{ uri: FINAL_CTA_ILLUSTRATION }}
        resizeMode="cover"
        style={styles.finalCtaArt}
        accessibilityLabel=""
      />
      <View style={styles.finalCtaScrim} />
      <View style={styles.finalCtaInner}>
        <Text style={styles.finalCtaEyebrow}>AI 시대, 스스로 묻는 아이로 자라게</Text>
        <Text style={styles.finalCtaTitle}>오늘 밤, 아이와 함께{'\n'}질문이 움직이는 동화를 시작해 보세요.</Text>
        <Text style={styles.finalCtaLead}>「헨젤과 그레텔」 한 편을 무료로 체험할 수 있어요.</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onGoToDemo}
          style={({ pressed }) => [sectionStyles.buttonGoldLarge, pressed && sectionStyles.pressed]}
        >
          <Text style={sectionStyles.buttonGoldLargeText}>무료로 한 편 체험하기</Text>
          <Icon name="next" size={18} color={storybookTheme.color.primary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  finalCta: {
    width: '100%',
    overflow: 'hidden',
  },
  finalCtaArt: {
    ...StyleSheet.absoluteFill,
    opacity: 0.28,
  },
  finalCtaScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(18, 10, 30, 0.72)',
  },
  finalCtaInner: {
    width: '100%',
    maxWidth: storybookTheme.layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 56,
    gap: 14,
    alignItems: 'flex-start',
  },
  finalCtaEyebrow: {
    color: storybookTheme.color.gold,
    fontSize: storybookTheme.type.xs,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  finalCtaTitle: {
    color: storybookTheme.color.onDark,
    fontSize: storybookTheme.type.xl,
    lineHeight: 34,
    fontWeight: '700',
  },
  finalCtaLead: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.md,
    lineHeight: storybookTheme.type.md * storybookTheme.lineHeight.normal,
    fontWeight: '300',
  },
});
