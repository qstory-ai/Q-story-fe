import { StyleSheet, Text, View } from 'react-native';

import { storybookTheme } from './theme';

type PillProps = {
  label: string;
  tone?: 'onDark' | 'onCard';
};

/** 작고 둥근 카테고리/상태 태그 - 스토리북 홈 서재와 이야기 상세 페이지가 처음으로 공유하는 배지. */
export function Pill({ label, tone = 'onCard' }: PillProps) {
  return (
    <View style={[styles.base, tone === 'onDark' ? styles.onDark : styles.onCard]}>
      <Text style={[styles.text, tone === 'onDark' ? styles.textOnDark : styles.textOnCard]}>{label}</Text>
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
  // 라이트 리테마: onDark tone은 이제 라이트 배경 위 강조 pill로 재해석 - 골드 배경 + 다크 텍스트.
  // (사이드바처럼 실제 다크 배경 위에서 쓰일 여지도 있어 골드 hue는 유지.)
  onDark: {
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
  textOnCard: {
    color: storybookTheme.color.primary,
  },
  textOnDark: {
    color: storybookTheme.color.onCardTitle,
  },
});
