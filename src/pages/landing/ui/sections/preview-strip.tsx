import { Image, Pressable, StyleSheet, View } from 'react-native';

import { SectionHeader, storybookTheme } from '@/shared/ui';

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
    borderRadius: storybookTheme.radius.card,
    overflow: 'hidden',
    // 다크 배경 위의 반투명 크림 서피스 - panelOnDarkBackground(0.08)와 정확히 일치.
    backgroundColor: storybookTheme.color.panelOnDarkBackground,
    borderWidth: 1,
    // 하얀 라이닝 border - panelOnDarkBorder(0.16)보다 조금 밝은 강조 라인이라 유지.
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
