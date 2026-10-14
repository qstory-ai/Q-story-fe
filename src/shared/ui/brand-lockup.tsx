import { Image, StyleSheet } from 'react-native';

type BrandLockupProps = {
  size?: 'default' | 'compact';
  /**
   * 어떤 배경 위에 놓이는지. 새 워드마크(보라 Q + 색 글자)는 밝은 바탕·어두운 바탕 모두에서 같은 그림을 쓴다 -
   * 부르는 쪽 코드를 그대로 두려고 값은 받는다.
   */
  tone?: 'onDark' | 'onLight';
};

/** 워드마크 원본(public/brand/qstory-wordmark.png = 랜딩 qstory-logo.png) 비율. */
const WORDMARK_ASPECT = 899 / 301;

/**
 * Q-Story 워드마크(Q 캐릭터 + "story"). 홈/플레이어/온보딩/대시보드 머리 등 여러 화면이 공유한다.
 */
export function BrandLockup({ size = 'default' }: BrandLockupProps) {
  return (
    <Image
      source={{ uri: '/brand/qstory-wordmark.png' }}
      resizeMode="contain"
      style={size === 'compact' ? styles.compact : styles.default}
      accessibilityLabel="Q-Story"
    />
  );
}

const styles = StyleSheet.create({
  default: { height: 40, width: 40 * WORDMARK_ASPECT },
  compact: { height: 32, width: 32 * WORDMARK_ASPECT },
});
