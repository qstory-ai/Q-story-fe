import { Image, Pressable, StyleSheet, View } from 'react-native';

import { SectionHeader } from '@/shared/ui';

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
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.24)',
  },
  previewThumbPressed: {
    opacity: 0.85,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
});
