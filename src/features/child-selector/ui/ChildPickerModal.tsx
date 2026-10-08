import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Modal, storybookTheme } from '@/shared/ui';
import { AddChildAvatar, ChildAvatar, useChildren, type Child } from '@/entities/child';

import { AddChildModal } from './AddChildModal';

type Props = {
  visible: boolean;
  /** 화면 부제 - 예: "이 이야기를 어떤 아이와 함께 볼까요?" */
  subtitle?: string;
  onClose: () => void;
  /** 아이를 골랐을 때 호출된다 - 인자는 방금 선택된 아이. 모달 닫기는 호출자 책임. */
  onSelected: (child: Child) => void;
};

/**
 * IA "이야기 시작 전 아이 선택" - 넷플릭스 프로필 선택기와 같은 UX. 홈·리포트의 선택 줄(ChildSelector)과 같은
 * 아바타·같은 금색 선택 표시를 쓰고, 지금 선택된 아이를 미리 표시한다(Q-36). 부모 홈의 작은 아이 셀렉터
 * (ChildSelector)와 달리, 이야기 시작이라는 이벤트 순간에만 뜨는 확인 스텝이라 큰 아바타
 * 그리드로 뚜렷하게 노출한다.
 *
 * <p>ChildrenProvider의 selectedChild도 함께 갱신해서 이후 홈/서재/리포트도 그 아이 기준으로
 * 유지되도록 한다. 아이가 아직 없으면 "아이 등록" 카드가 대신 노출되고, 등록 완료 시
 * ChildrenProvider가 새 아이를 자동 선택해 곧바로 onSelected로 이어진다.
 */
export function ChildPickerModal({ visible, subtitle, onClose, onSelected }: Props) {
  const { children, selectedChild, selectChild } = useChildren();
  const [addOpen, setAddOpen] = useState(false);
  const hasChildren = children.length > 0;

  function handlePick(child: Child) {
    selectChild(child.id);
    onSelected(child);
  }

  return (
    <>
      <Modal
        visible={visible && !addOpen}
        eyebrow="아이 선택"
        title="누구와 함께 볼까요?"
        accessibilityLabel="이야기 시작 전 아이 선택"
        linkAction={{ label: '취소', onPress: onClose }}
      >
        <View style={styles.body}>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

          {hasChildren ? (
            <View style={styles.grid}>
              {children.map((child) => (
                <ChildAvatarChoice
                  key={child.id}
                  child={child}
                  selected={child.id === selectedChild?.id}
                  onPress={() => handlePick(child)}
                />
              ))}
              <AddAvatarChoice onPress={() => setAddOpen(true)} />
            </View>
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                이 이야기를 시작하기 전에 아이 프로필을 먼저 등록해 주세요.
              </Text>
              <ActionButton label="아이 등록하기" onPress={() => setAddOpen(true)} />
            </View>
          )}
        </View>
      </Modal>

      <AddChildModal visible={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}

function ChildAvatarChoice({ child, selected, onPress }: { child: Child; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${child.name}으로 시작`}
      aria-selected={selected}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <ChildAvatar avatarKey={child.avatarKey} size="lg" selected={selected} />
      <Text style={[styles.tileName, selected && styles.tileNameSelected]} numberOfLines={1}>{child.name}</Text>
    </Pressable>
  );
}

function AddAvatarChoice({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="아이 추가"
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <AddChildAvatar size="lg" />
      <Text style={styles.tileName} numberOfLines={1}>아이 추가</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14 },
  subtitle: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.onCardBody,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 6,
  },
  tile: {
    width: 92,
    alignItems: 'center',
    gap: 6,
  },
  pressed: { opacity: 0.8 },
  tileName: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
    textAlign: 'center',
  },
  tileNameSelected: { color: storybookTheme.color.goldText },
  emptyBox: {
    gap: 12,
    paddingVertical: 12,
    alignItems: 'stretch',
  },
  emptyText: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.onCardBody,
    textAlign: 'center',
  },
});
