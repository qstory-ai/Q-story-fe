import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { storybookTheme } from './theme';
import { minTouchTarget, radius, semanticColors, space } from './tokens';

const L = semanticColors.light;

export type PillTabOption<T extends string> = { value: T; label: string; count?: number };

type Props<T extends string> = {
  options: ReadonlyArray<PillTabOption<T>>;
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  /** 칸을 똑같이 나눠 꽉 채운다(2~3개 짧은 탭). 기본은 내용 폭 + 넘치면 줄바꿈. */
  fill?: boolean;
  /**
   * 키보드 활성화 방식(ARIA tabs 패턴). `auto`(기본): 좌우 화살표로 옮기면 바로 선택된다.
   * `manual`: 화살표는 포커스만 옮기고 Enter/Space로 선택한다 - 선택이 목록을 다시 그리는 화면(서재)에 쓴다.
   */
  activation?: 'auto' | 'manual';
};

/**
 * 알약형 탭. 옅은 보라 트랙 위에서 선택된 탭은 보라 채움 + 흰 글자(5.46:1, 트랙과 5.18:1)라 색만으로도 구분이 분명하다.
 * 탭 높이 44px 이상. 넘치면 줄바꿈한다(글자를 자르거나 가려진 채 스크롤하지 않는다) - 트랙 radius 24라 두 줄이어도 어색하지 않다.
 * 접근성: role=tablist/tab, aria-selected, roving tabindex(포커스된 탭 하나만 Tab 순서), 좌우 화살표·Home·End.
 */
export function PillTabs<T extends string>({ options, value, onChange, accessibilityLabel, fill = false, activation = 'auto' }: Props<T>) {
  const tabRefs = useRef<Array<unknown>>([]);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const rovingIndex = focusIndex ?? selectedIndex;

  const moveTo = (index: number) => {
    const next = (index + options.length) % options.length;
    setFocusIndex(next);
    if (activation === 'auto') onChange(options[next].value);
    (tabRefs.current[next] as { focus?: () => void } | null)?.focus?.();
  };
  const onKeyDown = (event: { key: string; preventDefault: () => void }) => {
    const keys: Record<string, number> = {
      ArrowRight: rovingIndex + 1,
      ArrowLeft: rovingIndex - 1,
      Home: 0,
      End: options.length - 1,
    };
    if (event.key in keys) {
      event.preventDefault();
      moveTo(keys[event.key]);
    }
    // Space는 RNW Pressable이 tab 역할에서 눌림으로 처리하지 않아 여기서 선택한다(Enter는 onPress로 온다).
    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      onChange(options[rovingIndex].value);
    }
  };

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, fill && styles.trackFill]}
      {...({
        onKeyDown,
        // 포커스가 탭 목록 밖으로 나가면 roving 위치를 선택된 탭으로 되돌린다(다시 들어오면 선택된 탭부터).
        onBlur: (event: { currentTarget: { contains: (node: unknown) => boolean }; relatedTarget: unknown }) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setFocusIndex(null);
        },
      } as object)}
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
            // roving tabindex - 포커스된(처음엔 선택된) 탭만 Tab 순서에 들어간다.
            focusable={index === rovingIndex}
            {...({ tabIndex: index === rovingIndex ? 0 : -1 } as object)}
            onPress={() => {
              setFocusIndex(null);
              onChange(option.value);
            }}
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
    borderRadius: radius[24],
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
  tabFill: { flex: 1, paddingHorizontal: space[8] },
  tabHover: { backgroundColor: L.bg.interactive.selected.hover },
  tabSelected: { backgroundColor: L.bg.interactive.primary.default },
  label: {
    color: L.text.secondary,
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.semibold,
  },
  labelSelected: { color: L.text.interactive.inverse, fontWeight: storybookTheme.type.weight.bold },
  count: {
    minWidth: 20,
    paddingHorizontal: 6,
    borderRadius: radius.rounded,
    backgroundColor: L.bg.primary,
    alignItems: 'center',
  },
  countSelected: { backgroundColor: L.bg.primary },
  countLabel: {
    color: L.text.secondary,
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    fontVariant: ['tabular-nums'],
  },
  countLabelSelected: { color: L.text.interactive.selected },
});
