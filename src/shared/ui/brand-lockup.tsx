import { Image, StyleSheet } from 'react-native';

type BrandLockupProps = {
  /** default 높이 40, compact 32(대시보드 머리), mini 22(리더 상단 바). */
  size?: 'default' | 'compact' | 'mini';
};

/** 워드마크 원본(public/brand/qstory-wordmark.png = 랜딩 qstory-logo.png) 비율. */
const WORDMARK_ASPECT = 899 / 301;

/**
 * Q-Story 워드마크(Q 캐릭터 + "story"). 홈/플레이어/리더/온보딩/대시보드 머리 등 여러 화면이 공유한다.
 * 밝은 바탕·어두운 바탕 모두 같은 그림이다(리더처럼 삽화 위에 얹을 때는 부르는 쪽이 ivory 틀을 깐다).
 */
export function BrandLockup({ size = 'default' }: BrandLockupProps) {
  return (
    <Image
      source={{ uri: '/brand/qstory-wordmark.png' }}
      resizeMode="contain"
      style={styles[size]}
      accessibilityLabel="Q-Story"
    />
  );
}

const styles = StyleSheet.create({
  default: { height: 40, width: 40 * WORDMARK_ASPECT },
  compact: { height: 32, width: 32 * WORDMARK_ASPECT },
  mini: { height: 22, width: 22 * WORDMARK_ASPECT },
});
