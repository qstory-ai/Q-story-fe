import { Pressable, StyleSheet, Text, View } from 'react-native';

import { storybookTheme } from './theme';

/**
 * 카테고리 필터·탭 등에서 반복되던 pill 형태의 토글 컨트롤. 다크 배경 위에서만 쓴다.
 *
 * 두 tone:
 *  - `outline`: 배경 없이 테두리만. 선택 시 옅은 패널 배경 + gold 테두리. 여러 개를 나열해도
 *    시각적 무게가 가벼워 카테고리 필터처럼 다수 선택지에 적합.
 *  - `filled`: 선택 시 gold 배경 + 어두운 텍스트. 강조가 커 탭처럼 활성 상태를 뚜렷이
 *    보여줘야 하는 곳에 적합.
 *
 * LibraryPage/TutorLibraryPage가 각자 CategoryChip 컴포넌트와 tab Pressable 스타일을
 * 복제해 두던 것을 이 프리미티브로 흡수한다.
 */
export type FilterChipTone = 'outline' | 'filled';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  tone?: FilterChipTone;
  accessibilityRole?: 'button' | 'tab';
  /** 라벨 옆에 붙는 개수 뱃지 - 예: 서재 탭이 각 탭에 몇 개 있는지 미리 보여줄 때. 0은 렌더링 안 함. */
  count?: number;
};

export function FilterChip({
  label,
  selected,
  onPress,
  tone = 'outline',
  accessibilityRole = 'button',
  count,
}: Props) {
  const containerStyle =
    tone === 'filled'
      ? [styles.base, styles.filled, selected && styles.filledActive]
      : [styles.base, styles.outline, selected && styles.outlineActive];
  const labelStyle =
    tone === 'filled'
      ? [styles.label, styles.filledLabel, selected && styles.filledLabelActive]
      : [styles.label, styles.outlineLabel, selected && styles.outlineLabelActive];
  // 활성 상태의 뱃지 배경/글자색은 라벨 색과 대비되도록 자동 조정 - 톤/선택 여부의 4가지 조합.
  // container/text 스타일을 분리해 백그라운드/컬러가 각자 올바른 노드에만 적용되도록 한다.
  const badgeBg =
    tone === 'filled'
      ? selected ? styles.badgeBgFilledActive : styles.badgeBgFilledIdle
      : selected ? styles.badgeBgOutlineActive : styles.badgeBgOutlineIdle;
  const badgeFg =
    tone === 'filled'
      ? selected ? styles.badgeFgFilledActive : styles.badgeFgFilledIdle
      : selected ? styles.badgeFgOutlineActive : styles.badgeFgOutlineIdle;
  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [...containerStyle, styles.row, pressed && styles.pressed]}
    >
      <Text style={labelStyle}>{label}</Text>
      {count != null && count > 0 ? (
        <View style={[styles.badge, badgeBg]}>
          <Text style={[styles.badgeText, badgeFg]}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: storybookTheme.radius.pill,
    borderWidth: 1,
  },
  // 라이트 리테마: 흰 배경 위 chip은 outlined = 라이트 hairline, filled(active) = primary(네이비) 채움.
  outline: {
    paddingHorizontal: storybookTheme.spacing.ms,
    paddingVertical: 6,
    borderColor: storybookTheme.color.contentPanelBorder,
  },
  outlineActive: {
    backgroundColor: storybookTheme.color.pillBackground,
    borderColor: storybookTheme.color.primary,
  },
  filled: {
    paddingHorizontal: 14,
    paddingVertical: storybookTheme.spacing.sm,
    borderColor: storybookTheme.color.contentPanelBorder,
  },
  filledActive: {
    backgroundColor: storybookTheme.color.primary,
    borderColor: storybookTheme.color.primary,
  },
  // 지침 표준 scale(0.96) 추가. FilterChip은 탭 선택을 반복적으로 만지는 컨트롤이라 tactile
  // 피드백이 특히 중요.
  pressed: { opacity: 0.9, transform: [{ scale: 0.96 }] },
  label: {
    fontSize: storybookTheme.type.xs,
  },
  // 라이트 리테마: 라이트 배경 위 chip 라벨은 다크 텍스트.
  outlineLabel: {
    fontWeight: storybookTheme.type.weight.semibold,
    color: storybookTheme.color.onContentMuted,
  },
  outlineLabelActive: { color: storybookTheme.color.primary },
  filledLabel: {
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onContentMuted,
  },
  filledLabelActive: { color: storybookTheme.color.onDark },
  // 라벨과 뱃지를 나란히 놓기 위한 행 컨테이너 - 기본 pill에도 flexDirection이 필요.
  row: { flexDirection: 'row', alignItems: 'center', gap: storybookTheme.spacing.xs },
  badge: {
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: storybookTheme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: storybookTheme.type.xxs,
    fontWeight: storybookTheme.type.weight.bold,
  },
  // 라이트 리테마 뱃지 4가지 조합.
  badgeBgOutlineIdle: { backgroundColor: storybookTheme.color.pillBackground },
  badgeFgOutlineIdle: { color: storybookTheme.color.onContentMuted },
  badgeBgOutlineActive: { backgroundColor: storybookTheme.color.pillBackground },
  badgeFgOutlineActive: { color: storybookTheme.color.primary },
  badgeBgFilledIdle: { backgroundColor: storybookTheme.color.pillBackground },
  badgeFgFilledIdle: { color: storybookTheme.color.onContentMuted },
  // primary(네이비) 채움 chip 위 → 배지는 밝은 카드 톤으로 대비.
  badgeBgFilledActive: { backgroundColor: 'rgba(255, 255, 255, 0.18)' },
  badgeFgFilledActive: { color: storybookTheme.color.onDark },
});
