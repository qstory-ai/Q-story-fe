import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
 * 탭 높이 44px 이상. 줄바꿈하지 않고, 넘치면 가로로 스크롤한다(fill이면 칸을 나눠 꽉 채운다).
 * 접근성(ARIA tabs 패턴): role=tablist/tab, aria-selected, roving tabindex(선택된 탭만 Tab 키로 들어온다),
 * 좌우 화살표·Home·End로 탭을 옮기며 바로 선택한다.
 */
export function PillTabs<T extends string>({ options, value, onChange, accessibilityLabel, fill = false }: Props<T>) {
  const tabRefs = useRef<Array<unknown>>([]);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));

  const moveTo = (index: number) => {
    const next = (index + options.length) % options.length;
    onChange(options[next].value);
    (tabRefs.current[next] as unknown as { focus?: () => void } | null)?.focus?.();
  };
  const onKeyDown = (event: { key: string; preventDefault: () => void }) => {
    const keys: Record<string, number> = {
      ArrowRight: selectedIndex + 1,
      ArrowLeft: selectedIndex - 1,
      Home: 0,
      End: options.length - 1,
    };
    if (!(event.key in keys)) return;
    event.preventDefault();
    moveTo(keys[event.key]);
  };

  const track = (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, fill && styles.trackFill]}
      {...({ onKeyDown } as object)}
    >
      {options.map((option, index) => {
        const selected = index === selectedIndex;
        return (
          <Pressable
            key={option.value}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            accessibilityRole="tab"
            aria-selected={selected}
            // roving tabindex - 선택된 탭만 Tab 순서에 들어간다.
            focusable={selected}
            {...({ tabIndex: selected ? 0 : -1 } as object)}
            onPress={() => onChange(option.value)}
            style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) => [
              styles.tab,
              fill && styles.tabFill,
              !selected && (pressed || hovered) && styles.tabHover,
              selected && styles.tabSelected,
            ]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>{option.label}</Text>
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

  if (fill) return track;
  // 내용 폭 모드: 좁은 화면에서 넘치면 줄바꿈 대신 가로 스크롤.
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent} style={styles.scroll}>
      {track}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    flexWrap: 'nowrap',
    gap: space[4],
    padding: space[4],
    borderRadius: radius.rounded,
    backgroundColor: L.bg.brandSubtle,
  },
  trackFill: { alignSelf: 'stretch' },
  scroll: { flexGrow: 0 },
  scrollContent: { flexGrow: 0 },
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
