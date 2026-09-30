import { StyleSheet, Text, View } from 'react-native';

import { storybookTheme } from './theme';

/**
 * tone 카탈로그:
 *  - `onCard`(기본): 라이트 카드 위 옅은 primary 톤 pill - 카테고리/카운트 라벨 대부분.
 *  - `onLight`: 라이트 서피스 위 상태 라벨용 중립 톤 - "부모 연결 대기" 같은 상태 pill.
 *  - `accent`: 골드 강조 톤 - CTA 유도가 필요한 소수 위치.
 */
type PillProps = {
  label: string;
  tone?: 'onCard' | 'onLight' | 'accent';
};

/** 작고 둥근 카테고리/상태 태그. */
export function Pill({ label, tone = 'onCard' }: PillProps) {
  const containerStyle =
    tone === 'accent' ? styles.accent
    : tone === 'onLight' ? styles.onLight
    : styles.onCard;
  const textStyle =
    tone === 'accent' ? styles.textAccent
    : tone === 'onLight' ? styles.textOnLight
    : styles.textOnCard;
  return (
    <View style={[styles.base, containerStyle]}>
      <Text style={[styles.text, textStyle]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: storybookTheme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  onCard: {
    backgroundColor: storybookTheme.color.pillBackground,
    borderColor: storybookTheme.color.pillBorder,
  },
  // 상태 라벨 - 카드 위에서도 조용히 앉는 중립 톤.
  onLight: {
    backgroundColor: storybookTheme.color.contentPanel,
    borderColor: storybookTheme.color.contentPanelBorder,
  },
  // 골드 강조 - CTA/알림 배지처럼 눈에 띄어야 하는 소수 케이스.
  accent: {
    backgroundColor: 'rgba(246, 198, 77, 0.22)',
    borderColor: 'rgba(246, 198, 77, 0.55)',
  },
  text: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.semibold,
    // Pill 라벨 상당수가 "학생 3명" / "이야기 12편" / "97점" 같은 카운트라, 값이 바뀔 때
    // 자릿수 별 폭 차이로 인접 pill 위치가 밀리지 않도록 tabular. 순수 텍스트 라벨에도 무해.
    fontVariant: ['tabular-nums'],
  },
  textOnCard: { color: storybookTheme.color.primary },
  textOnLight: { color: storybookTheme.color.onContentMuted },
  textAccent: { color: storybookTheme.color.onCardTitle },
});
