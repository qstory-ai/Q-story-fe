import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon, storybookTheme } from '@/shared/ui';
import { findChildAvatar, useChildren, type Child } from '@/entities/child';
import { AddChildModal } from './AddChildModal';

type Props = {
  /**
   * 아바타 옆의 텍스트 카피를 표시 - 예: "OO님, 오늘 어떤 이야기를 함께 볼까요?".
   * 홈의 브랜딩 문구가 이 컴포넌트 밖(브랜드 로고 헤더)에 이미 있어서 여긴 생략도 가능하다.
   */
  greeting?: string;
  /**
   * 맨 앞의 "전체" 같은 보기 전용 선택지(리포트의 "전체 아이"). 켜져 있으면 어떤 아이도 강조하지 않는다.
   * 전역 선택 아이는 그대로 두므로, 아이를 다시 누르면 그 아이 보기로 돌아온다.
   */
  allOption?: { label: string; selected: boolean; onPress: () => void };
  /** 아이를 누른 뒤 호출 - 전역 선택(selectChild)은 이 컴포넌트가 이미 바꿨다. */
  onSelect?: (childId: string) => void;
  /** "아이 추가" 버튼 노출(기본 true). */
  showAdd?: boolean;
};

/**
 * 넷플릭스식 아이 선택기 - 가로 스크롤 아바타 리스트 뒤에 "+" 원형 버튼이 붙는다. 각 아바타를
 * 누르면 ChildrenProvider의 selectedChild가 갱신되고, 그 결과 보호자 홈·리포트가
 * 같은 아이 기준으로 리렌더된다 - 아이 선택 상태는 이 전역 선택 하나뿐이다. 아이가 하나도 없을 땐 "아이를 먼저 등록해 주세요" 안내와
 * "+" 버튼만 노출한다.
 */
export function ChildSelector({ greeting, allOption, onSelect, showAdd = true }: Props) {
  const { load, children, selectedChild, selectChild } = useChildren();
  const [addOpen, setAddOpen] = useState(false);

  const isReady = load.status === 'ready';
  const hasChildren = children.length > 0;

  return (
    <View style={styles.container}>
      {greeting ? <Text style={styles.greeting}>{greeting}</Text> : null}

      {isReady && !hasChildren ? (
        <View style={styles.emptyRow}>
          <Text style={styles.emptyMessage}>아이 프로필을 먼저 등록해 주세요.</Text>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {allOption && hasChildren ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${allOption.label} 보기`}
            aria-selected={allOption.selected}
            onPress={allOption.onPress}
            style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}
          >
            <View
              style={[
                styles.avatarFrame,
                styles.allFrame,
                allOption.selected && { borderColor: storybookTheme.color.gold },
              ]}
            >
              <Icon name="users" size={24} color={storybookTheme.color.onContent} />
            </View>
            <Text style={[styles.avatarName, allOption.selected && styles.avatarNameSelected]} numberOfLines={1}>
              {allOption.label}
            </Text>
          </Pressable>
        ) : null}
        {children.map((child) => (
          <ChildAvatarButton
            key={child.id}
            child={child}
            selected={!allOption?.selected && child.id === selectedChild?.id}
            onPress={() => {
              selectChild(child.id);
              onSelect?.(child.id);
            }}
          />
        ))}
        {showAdd ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="아이 추가"
          onPress={() => setAddOpen(true)}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
        >
          <View style={styles.addFrame}>
            <Icon name="plus" size={22} color={storybookTheme.color.onContent} />
          </View>
          <Text style={styles.addLabel} numberOfLines={1}>아이 추가</Text>
        </Pressable>
        ) : null}
      </ScrollView>

      {load.status === 'error' ? (
        <Text style={styles.errorText}>{load.message}</Text>
      ) : null}

      <AddChildModal visible={addOpen} onClose={() => setAddOpen(false)} />
    </View>
  );
}

function ChildAvatarButton({
  child,
  selected,
  onPress,
}: {
  child: Child;
  selected: boolean;
  onPress: () => void;
}) {
  const preset = findChildAvatar(child.avatarKey);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${child.name} 선택`}
      aria-selected={selected}
      onPress={onPress}
      style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}
    >
      <View
        style={[
          styles.avatarFrame,
          {
            borderColor: selected ? storybookTheme.color.gold : 'transparent',
            backgroundColor: `${preset.accent}33`,
          },
        ]}
      >
        <Text style={styles.avatarEmoji}>{preset.emoji}</Text>
      </View>
      <Text style={[styles.avatarName, selected && styles.avatarNameSelected]} numberOfLines={1}>
        {child.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', gap: 8 },
  greeting: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.onContentMuted,
    paddingHorizontal: 4,
  },
  emptyRow: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  emptyMessage: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onContentMuted,
  },
  scroll: {
    gap: 14,
    paddingHorizontal: 4,
    paddingVertical: 6,
    alignItems: 'flex-start',
  },
  avatarButton: {
    width: 64,
    gap: 4,
    alignItems: 'center',
  },
  avatarFrame: {
    width: 60,
    height: 60,
    borderRadius: storybookTheme.radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 28 },
  allFrame: { borderColor: 'transparent', backgroundColor: storybookTheme.color.contentPanel },
  avatarName: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onContentMuted,
    fontWeight: storybookTheme.type.weight.semibold,
    textAlign: 'center',
    maxWidth: 62,
  },
  avatarNameSelected: {
    color: storybookTheme.color.goldText,
    fontWeight: storybookTheme.type.weight.bold,
  },
  addButton: {
    width: 64,
    gap: 4,
    alignItems: 'center',
  },
  addFrame: {
    width: 60,
    height: 60,
    borderRadius: storybookTheme.radius.pill,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: storybookTheme.color.contentPanelBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: storybookTheme.color.contentPanel,
  },
  pressed: { opacity: 0.8 },
  addLabel: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onContentMuted,
    fontWeight: storybookTheme.type.weight.semibold,
    maxWidth: 62,
    textAlign: 'center',
  },
  errorText: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.error,
    paddingHorizontal: 4,
  },
});
