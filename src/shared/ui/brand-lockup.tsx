import { Image, StyleSheet, Text, View } from 'react-native';

import { storybookTheme } from './theme';

type BrandLockupProps = {
  size?: 'default' | 'compact';
  /**
   * 어떤 배경 위에 놓이는지. 'onDark'(기본)는 리더·랜딩의 다크 배경용(골드 Q + 흰 워드마크).
   * 'onLight'는 콘솔·인증 화면의 라이트 배경용 - 흰 워드마크가 배경에 묻혀 "Q-STORY"가 보이지
   * 않던 문제를 여기서 막는다(네이비 워드마크 + 앰버 Q + hairline 프레임).
   */
  tone?: 'onDark' | 'onLight';
};

/**
 * Q-Story 로고 마크 + 워드마크. 리더의 상단바(pages/one-story/ui/top-bar.tsx)와
 * 새 home/player 화면들 사이에서 공유된다 - 이전에는 HomePage와 top-bar에 그대로 중복되어 있었다.
 */
export function BrandLockup({ size = 'default', tone = 'onDark' }: BrandLockupProps) {
  const compact = size === 'compact';
  const onLight = tone === 'onLight';
  return (
    <View style={styles.lockup}>
      <View style={[styles.frame, compact && styles.frameCompact, onLight && styles.frameOnLight]}>
        <Image
          source={{ uri: '/brand/q-story-question-book-logo.svg' }}
          resizeMode="contain"
          style={[styles.logo, compact && styles.logoCompact]}
          accessibilityLabel="Q-Story 로고"
        />
      </View>
      <Text style={[styles.brand, compact && styles.brandCompact]}>
        <Text style={[styles.brandQ, onLight && styles.brandQOnLight]}>Q</Text>
        <Text style={[styles.brandRest, onLight && styles.brandRestOnLight]}>-STORY</Text>
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
  frameOnLight: {
    backgroundColor: storybookTheme.color.contentSurface,
    borderColor: storybookTheme.color.contentSurfaceBorder,
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
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    letterSpacing: 1.8,
  },
  brandCompact: {
    fontSize: storybookTheme.type.xs,
    letterSpacing: 1.6,
  },
  brandQ: {
    color: storybookTheme.color.gold,
  },
  brandRest: {
    color: storybookTheme.color.onDark,
  },
  brandQOnLight: { color: storybookTheme.color.goldText },
  brandRestOnLight: { color: storybookTheme.color.onContent },
});
