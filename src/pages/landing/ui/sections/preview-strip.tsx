import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, SectionHeader, storybookTheme } from '@/shared/ui';

import { PREVIEW_ILLUSTRATIONS } from '../../model/content';
import { sectionStyles } from '../section-styles';

type PreviewStripSectionProps = {
  onGoToDemo: () => void;
};

export function PreviewStripSection({ onGoToDemo }: PreviewStripSectionProps) {
  return (
    <View style={sectionStyles.section}>
      <SectionHeader title="이런 장면을 만나요" subtitle="체험판 「헨젤과 그레텔」 속 한 장면들" />
      <View style={styles.previewRow}>
        {PREVIEW_ILLUSTRATIONS.map((item) => (
          <Pressable
            key={item.id}
            onPress={onGoToDemo}
            accessibilityRole="button"
            accessibilityLabel={`${item.label} - 무료로 체험 시작하기`}
            style={({ pressed }) => [styles.previewThumb, pressed && styles.previewThumbPressed]}
          >
            <Image source={{ uri: item.uri }} resizeMode="cover" style={styles.previewImage} accessibilityLabel={item.label} />
            <View style={styles.previewCaption}>
              <Text style={styles.previewCaptionText} numberOfLines={1}>{item.label}</Text>
              <View style={styles.previewCta}>
                <Text style={styles.previewCtaText}>체험하기</Text>
                <Icon name="next" size={13} color={storybookTheme.color.primary} />
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  previewRow: {
    flexDirection: 'row',
    gap: 10,
  },
  previewThumb: {
    flex: 1,
    minHeight: 184,
    borderRadius: storybookTheme.radius.card,
    overflow: 'hidden',
    backgroundColor: storybookTheme.color.contentSurface,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentSurfaceBorder,
  },
  previewThumbPressed: {
    opacity: 0.85,
  },
  previewImage: {
    width: '100%',
    flex: 1,
  },
  previewCaption: {
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  previewCaptionText: {
    color: storybookTheme.color.onContent,
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.semibold,
  },
  previewCta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
  },
  previewCtaText: {
    color: storybookTheme.color.primary,
    fontSize: storybookTheme.type.xxs,
    fontWeight: storybookTheme.type.weight.bold,
  },
});
