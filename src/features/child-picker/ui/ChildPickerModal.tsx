import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Modal, storybookTheme } from '@/shared/ui';
import { findChildAvatar, useChildren, type Child } from '@/entities/child';
import { AddChildModal } from '@/features/child-selector';

type Props = {
  visible: boolean;
  title?: string;
  /** 화면 부제 - 예: "이 이야기를 어떤 아이와 함께 볼까요?" */
  subtitle?: string;
  onClose: () => void;
  /** 아이를 골랐을 때 호출된다 - 인자는 방금 선택된 아이. 모달 닫기는 호출자 책임. */
  onSelected: (child: Child) => void;
};

/**
 * IA "이야기 시작 전 아이 선택" - 넷플릭스 프로필 선택기와 같은 UX. 부모 홈의 작은 아이 셀렉터
 * (ChildSelector)와 달리, 이야기 시작이라는 이벤트 순간에만 뜨는 확인 스텝이라 큰 아바타
 * 그리드로 뚜렷하게 노출한다.
 *
 * <p>ChildrenProvider의 selectedChild도 함께 갱신해서 이후 홈/서재/리포트도 그 아이 기준으로
 * 유지되도록 한다. 아이가 아직 없으면 "아이 등록" 카드가 대신 노출되고, 등록 완료 시
 * ChildrenProvider가 새 아이를 자동 선택해 곧바로 onSelected로 이어진다.
 */
export function ChildPickerModal({ visible, title, subtitle, onClose, onSelected }: Props) {
  const { children, selectChild } = useChildren();
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
        title={title ?? '누구와 함께 볼까요?'}
        accessibilityLabel="이야기 시작 전 아이 선택"
        linkAction={{ label: '취소', onPress: onClose }}
      >
        <View style={styles.body}>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

          {hasChildren ? (
            <View style={styles.grid}>
              {children.map((child) => (
                <ChildAvatarChoice key={child.id} child={child} onPress={() => handlePick(child)} />
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

function ChildAvatarChoice({ child, onPress }: { child: Child; onPress: () => void }) {
  const preset = findChildAvatar(child.avatarKey);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${child.name}으로 시작`}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <View style={[styles.avatarFrame, { backgroundColor: `${preset.accent}33`, borderColor: preset.accent }]}>
        <Text style={styles.avatarEmoji}>{preset.emoji}</Text>
      </View>
      <Text style={styles.tileName} numberOfLines={1}>{child.name}</Text>
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
      <View style={styles.addFrame}>
        <Text style={styles.addPlus}>+</Text>
      </View>
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
  avatarFrame: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 40 },
  tileName: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
    textAlign: 'center',
  },
  addFrame: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: storybookTheme.color.onCardMuted,
    backgroundColor: storybookTheme.color.pillBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPlus: {
    fontSize: 40,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardMuted,
    lineHeight: 40,
  },
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
