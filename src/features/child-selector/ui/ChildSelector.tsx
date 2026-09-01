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
};

/**
 * 넷플릭스식 아이 선택기 - 가로 스크롤 아바타 리스트 뒤에 "+" 원형 버튼이 붙는다. 각 아바타를
 * 누르면 ChildrenProvider의 selectedChild가 갱신되고, 그 결과 부모 홈의 다른 섹션들이
 * 새 아이 기준으로 리렌더된다. 아이가 하나도 없을 땐 "아이를 먼저 등록해 주세요" 안내와
 * "+" 버튼만 노출한다.
 */
export function ChildSelector({ greeting }: Props) {
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
        {children.map((child) => (
          <ChildAvatarButton
            key={child.id}
            child={child}
            selected={child.id === selectedChild?.id}
            onPress={() => selectChild(child.id)}
          />
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="아이 추가"
          onPress={() => setAddOpen(true)}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
        >
          <View style={styles.addFrame}>
            <Icon name="plus" size={22} color={storybookTheme.color.onDark} />
          </View>
          <Text style={styles.addLabel} numberOfLines={1}>아이 추가</Text>
        </Pressable>
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
      accessibilityState={{ selected }}
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
    color: storybookTheme.color.onDarkMuted,
    paddingHorizontal: 4,
  },
  emptyRow: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  emptyMessage: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onDarkMuted,
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
    borderRadius: 30,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 28 },
  avatarName: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onDarkMuted,
    fontWeight: storybookTheme.type.weight.semibold,
    textAlign: 'center',
    maxWidth: 62,
  },
  avatarNameSelected: {
    color: storybookTheme.color.gold,
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
    borderRadius: 30,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: storybookTheme.color.panelOnDarkBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: storybookTheme.color.panelOnDarkBackground,
  },
  pressed: { opacity: 0.8 },
  addLabel: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onDarkMuted,
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
