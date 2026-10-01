import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { createPortal } from 'react-dom';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FieldDescription, FieldError, FieldLabel, fieldBackgroundColor, fieldBorderColor, fieldTextColor, type FieldState } from './field-primitives';
import { Icon } from './icon';
import { storybookTheme } from './theme';

export type SelectOption = { value: string; label: string };

type SelectFieldProps = {
  label: string;
  description?: string;
  errorText?: string;
  placeholder?: string;
  options: SelectOption[];
  value: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
};

const OPTIONS_GAP = 6;
const OPTIONS_MAX_HEIGHT = 220;

type MenuRect = { left: number; width: number; top?: number; bottom?: number };

/** 커스텀 드롭다운 - Figma "Select Field". 웹 전용 앱이라 트리거 바깥을 누르면 닫히도록
 * position:'fixed' 배경막을 쓴다(react-native-web 확장 - RN 코어에는 없는 값).
 *
 * <p>목록은 Modal처럼 document.body에 포탈로 올린다. RNW의 View는 모두 zIndex:0인 stacking
 * context라 트리 안에 두면 목록의 zIndex가 필드 안에서만 통해, DOM 순서상 뒤에 오는 입력칸이
 * 목록을 덮어 옵션을 누를 수 없었다. 위치는 트리거 좌표로 정하고, 스크롤·리사이즈되면 다시 잰다
 * (닫아 버리면 트리거를 누를 때 생기는 포커스 스크롤만으로도 목록이 바로 닫혔다). */
export function SelectField({
  label,
  description,
  errorText,
  placeholder = '선택해 주세요',
  options,
  value,
  onChange,
  disabled,
}: SelectFieldProps) {
  const [menuRect, setMenuRect] = useState<MenuRect | null>(null);
  const triggerRef = useRef<ComponentRef<typeof Pressable>>(null);
  const open = menuRect !== null;
  const repositionMenu = useCallback(() => setMenuRect(measureMenuRect(triggerRef.current)), []);
  const selected = options.find((option) => option.value === value) ?? null;
  const state: FieldState = disabled ? 'disabled' : errorText ? 'error' : 'default';

  return (
    <View style={styles.container}>
      <FieldLabel disabled={disabled}>{label}</FieldLabel>
      {description ? <FieldDescription disabled={disabled}>{description}</FieldDescription> : null}
      <View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          aria-disabled={disabled} aria-expanded={open}
          disabled={disabled}
          ref={triggerRef}
          onPress={() => (open ? setMenuRect(null) : setMenuRect(measureMenuRect(triggerRef.current)))}
          style={[
            styles.trigger,
            { borderColor: fieldBorderColor(state), backgroundColor: fieldBackgroundColor(state) },
          ]}
        >
          <Text
            style={[
              styles.value,
              { color: selected ? fieldTextColor(state) : disabled ? storybookTheme.color.disabledText : storybookTheme.color.onLightMuted },
            ]}
            numberOfLines={1}
          >
            {selected ? selected.label : placeholder}
          </Text>
          <Icon
            name="chevronDown"
            size={16}
            color={disabled ? storybookTheme.color.disabledText : storybookTheme.color.onLightMuted}
          />
        </Pressable>
        {open && !disabled ? (
          <SelectMenu
            rect={menuRect}
            onReposition={repositionMenu}
            options={options}
            value={value}
            onClose={() => setMenuRect(null)}
            onSelect={(next) => {
              onChange(next);
              setMenuRect(null);
            }}
          />
        ) : null}
      </View>
      {errorText ? <FieldError>{errorText}</FieldError> : null}
    </View>
  );
}

function measureMenuRect(trigger: ComponentRef<typeof Pressable> | null): MenuRect | null {
  const node = trigger as unknown as HTMLElement | null;
  if (!node?.getBoundingClientRect || typeof window === 'undefined') return null;
  const rect = node.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  // 아래 공간이 모자라고 위가 더 넓으면 위로 연다(화면 하단 필드에서 목록이 잘리지 않게).
  if (spaceBelow < OPTIONS_MAX_HEIGHT + OPTIONS_GAP && rect.top > spaceBelow) {
    return { left: rect.left, width: rect.width, bottom: window.innerHeight - rect.top + OPTIONS_GAP };
  }
  return { left: rect.left, width: rect.width, top: rect.bottom + OPTIONS_GAP };
}

function SelectMenu({
  rect,
  onReposition,
  options,
  value,
  onClose,
  onSelect,
}: {
  rect: MenuRect;
  onReposition: () => void;
  options: SelectOption[];
  value: string | null;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  const menuRef = useRef<ComponentRef<typeof View>>(null);

  useEffect(() => {
    function onScroll(event: Event) {
      // 목록 자체를 스크롤할 때는 위치가 그대로다.
      const menuNode = menuRef.current as unknown as HTMLElement | null;
      if (menuNode && event.target instanceof Node && menuNode.contains(event.target)) return;
      onReposition();
    }
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onReposition);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onReposition);
    };
  }, [onReposition]);

  const menu = (
    <>
      <Pressable
        accessibilityElementsHidden
        style={[StyleSheet.absoluteFill, styles.backdrop] as never}
        onPress={onClose}
      />
      <View ref={menuRef} style={[styles.options, { position: 'fixed', ...rect } as never]}>
        <ScrollView style={styles.optionsScroll} bounces={false}>
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="menuitem"
                aria-selected={isSelected}
                onPress={() => onSelect(option.value)}
                style={({ pressed }) => [
                  styles.option,
                  pressed && styles.optionPressed,
                  isSelected && styles.optionSelected,
                ]}
              >
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </>
  );

  if (typeof document === 'undefined') return menu;
  return createPortal(menu, document.body);
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  trigger: {
    minHeight: 48,
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    paddingHorizontal: storybookTheme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: storybookTheme.spacing.sm,
  },
  value: { flex: 1, fontSize: storybookTheme.type.md },
  backdrop: { position: 'fixed', zIndex: storybookTheme.zIndex.overlay } as never,
  options: {
    maxHeight: OPTIONS_MAX_HEIGHT,
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    borderColor: storybookTheme.color.lightCardBorder,
    backgroundColor: storybookTheme.color.surfaceWhite,
    zIndex: storybookTheme.zIndex.overlay + 1,
    ...storybookTheme.elevation.low,
  },
  optionsScroll: { borderRadius: storybookTheme.radius.card },
  option: { minHeight: 44, justifyContent: 'center', paddingHorizontal: storybookTheme.spacing.md },
  optionPressed: { backgroundColor: storybookTheme.color.pillBackground },
  optionSelected: { backgroundColor: storybookTheme.color.pillBackground },
  optionText: { fontSize: storybookTheme.type.md, color: storybookTheme.color.onCardTitle },
  optionTextSelected: { fontWeight: storybookTheme.type.weight.semibold, color: storybookTheme.color.primary },
});
