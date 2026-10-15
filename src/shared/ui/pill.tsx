import { StyleSheet, Text, View } from 'react-native';

import { storybookTheme } from './theme';
import { borderWidth, radius, semanticColors, space } from './tokens';

const L = semanticColors.light;

/**
 * tone 카탈로그(Pill = Badge):
 *  - `onCard`(기본): 옅은 보라 바탕 + 보라 글자 - 카테고리/카운트 라벨 대부분.
 *  - `onLight`: 중립 톤 상태 라벨 - "부모 연결 대기" 같은 조용한 상태.
 *  - `accent`: onCard보다 한 단계 진한 보라 바탕 + 진한 글자 - CTA 유도가 필요한 소수 위치.
 *  - `info` / `success` / `error`: 상태 배지. 바탕은 *-subtle, 글자는 대비 4.5:1 이상인 짝만 쓴다.
 */
export type PillTone = 'onCard' | 'onLight' | 'accent' | 'info' | 'success' | 'error';

type PillProps = {
  label: string;
  tone?: PillTone;
};

const TONES: Record<PillTone, { bg: string; border: string; fg: string }> = {
  onCard: { bg: L.bg.brandSubtle, border: L.border.brandSubtle, fg: L.text.interactive.selected },
  onLight: { bg: L.bg.secondary, border: L.border.secondary, fg: L.text.secondary },
  accent: { bg: L.bg.interactive.selected.hover, border: L.border.brandSubtle, fg: L.text.primary },
  // text/info는 옅은 하늘 바탕 위 4.22라 정보 배지 글자는 text/secondary.
  info: { bg: L.bg.infoSubtle, border: L.border.infoSubtle, fg: L.text.secondary },
  success: { bg: L.bg.successSubtle, border: L.border.successSubtle, fg: L.text.success },
  error: { bg: L.bg.errorSubtle, border: L.border.errorSubtle, fg: L.text.error },
};

/** 작고 둥근 카테고리/상태 태그. */
export function Pill({ label, tone = 'onCard' }: PillProps) {
  const t = TONES[tone];
  return (
    <View style={[styles.base, { backgroundColor: t.bg, borderColor: t.border }]}>
      <Text style={[styles.text, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

/** Pill과 같은 것 - 상태 표시 문맥에서 이름을 맞춰 쓰도록. */
export const Badge = Pill;

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: radius.rounded,
    borderWidth: borderWidth[1],
    paddingHorizontal: space[12],
    paddingVertical: space[4],
  },
  text: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.semibold,
    // Pill 라벨 상당수가 "학생 3명" / "이야기 12편" / "97점" 같은 카운트라, 값이 바뀔 때
    // 자릿수 별 폭 차이로 인접 pill 위치가 밀리지 않도록 tabular. 순수 텍스트 라벨에도 무해.
    fontVariant: ['tabular-nums'],
  },
});
