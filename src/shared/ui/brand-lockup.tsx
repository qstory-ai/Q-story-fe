import { Image, StyleSheet, Text, View } from 'react-native';

import { storybookTheme } from './theme';

type BrandLockupProps = {
  size?: 'default' | 'compact';
};

/**
 * Q-Story 로고 마크 + 워드마크. 리더의 상단바(pages/one-story/ui/top-bar.tsx)와
 * 새 home/player 화면들 사이에서 공유된다 - 이전에는 HomePage와 top-bar에 그대로 중복되어 있었다.
 */
export function BrandLockup({ size = 'default' }: BrandLockupProps) {
  const compact = size === 'compact';
  return (
    <View style={styles.lockup}>
      <View style={[styles.frame, compact && styles.frameCompact]}>
        <Image
          source={{ uri: '/brand/q-story-question-book-logo.svg' }}
          resizeMode="contain"
          style={[styles.logo, compact && styles.logoCompact]}
          accessibilityLabel="Q-Story 로고"
        />
      </View>
      <Text style={[styles.brand, compact && styles.brandCompact]}>
        <Text style={styles.brandQ}>Q</Text>
        <Text style={styles.brandRest}>-STORY</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  frame: {
    width: 50,
    height: 54,
    borderRadius: storybookTheme.radius.logoFrame,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: storybookTheme.color.brandFrameBackground,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
  },
  frameCompact: {
    width: 40,
    height: 43,
  },
  logo: {
    width: 42,
    height: 46,
  },
  logoCompact: {
    width: 33,
    height: 36,
  },
  brand: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  brandCompact: {
    fontSize: 13,
    letterSpacing: 1.6,
  },
  brandQ: {
    color: storybookTheme.color.gold,
  },
  brandRest: {
    color: storybookTheme.color.onDark,
  },
});
