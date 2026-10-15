import { Pressable, StyleSheet, Text, View } from 'react-native';

import { storybookTheme } from './theme';
import { minTouchTarget, radius, semanticColors, shadow, space } from './tokens';

const L = semanticColors.light;

export type PillTabOption<T extends string> = { value: T; label: string; count?: number };

type Props<T extends string> = {
  options: ReadonlyArray<PillTabOption<T>>;
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  /** 칸을 똑같이 나눠 꽉 채운다(2~3개 탭). 기본은 내용 폭. */
  fill?: boolean;
};

/**
 * 알약형 탭(segmented). 옅은 보라 트랙 위에 선택된 탭만 흰 알약 + 그림자로 떠오른다(랜딩 "어떻게" 탭과 같은 결).
 * 탭 높이 44px 이상. role=tablist/tab, aria-selected.
 */
export function PillTabs<T extends string>({ options, value, onChange, accessibilityLabel, fill = false }: Props<T>) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel={accessibilityLabel} style={[styles.track, fill && styles.trackFill]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            aria-selected={selected}
            onPress={() => onChange(option.value)}
            style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) => [
              styles.tab,
              fill && styles.tabFill,
              !selected && (pressed || hovered) && styles.tabHover,
              selected && styles.tabSelected,
            ]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
            {option.count != null && option.count > 0 ? (
              <View style={[styles.count, selected && styles.countSelected]}>
                <Text style={[styles.countLabel, selected && styles.countLabelSelected]}>{option.count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    flexWrap: 'wrap',
    gap: space[4],
    padding: space[4],
    borderRadius: radius.rounded,
    backgroundColor: L.bg.brandSubtle,
  },
  trackFill: { alignSelf: 'stretch', flexWrap: 'nowrap' },
  tab: {
    minHeight: minTouchTarget,
    minWidth: minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[4],
    paddingHorizontal: space[16],
    borderRadius: radius.rounded,
  },
  tabFill: { flex: 1 },
  tabHover: { backgroundColor: L.bg.interactive.selected.hover },
  tabSelected: { backgroundColor: L.bg.primary, ...shadow(1) },
  label: {
    color: L.text.secondary,
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.semibold,
  },
  labelSelected: { color: L.text.interactive.selected, fontWeight: storybookTheme.type.weight.bold },
  count: {
    minWidth: 20,
    paddingHorizontal: 6,
    borderRadius: radius.rounded,
    backgroundColor: L.bg.primary,
    alignItems: 'center',
  },
  countSelected: { backgroundColor: L.bg.brandSubtle },
  countLabel: {
    color: L.text.secondary,
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    fontVariant: ['tabular-nums'],
  },
  countLabelSelected: { color: L.text.interactive.selected },
});
