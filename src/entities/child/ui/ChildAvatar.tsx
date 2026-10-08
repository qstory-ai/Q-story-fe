import { StyleSheet, Text, View } from 'react-native';

import { Icon, storybookTheme } from '@/shared/ui';

import { findChildAvatar } from '../model/avatars';

/** sm: 목록 한 줄(마이페이지) · md: 홈·리포트 선택 줄 · lg: 이야기 시작 전 아이 선택. */
export type ChildAvatarSize = 'sm' | 'md' | 'lg';

const DIAMETER: Record<ChildAvatarSize, number> = { sm: 48, md: 60, lg: 84 };
const EMOJI: Record<ChildAvatarSize, number> = { sm: 24, md: 28, lg: 40 };

/**
 * 아이 아바타 하나 - 아이를 고르는 곳(홈·리포트의 선택 줄, 이야기 시작 전 선택)과 아이 목록이 모두 이걸 쓴다(Q-36).
 * 선택된 아이는 어느 화면에서나 같은 금색 테두리로 보인다.
 */
export function ChildAvatar({
  avatarKey,
  size = 'md',
  selected = false,
}: {
  avatarKey: string | null | undefined;
  size?: ChildAvatarSize;
  selected?: boolean;
}) {
  const preset = findChildAvatar(avatarKey);
  const diameter = DIAMETER[size];
  return (
    <View
      style={[
        styles.frame,
        {
          width: diameter,
          height: diameter,
          borderColor: selected ? storybookTheme.color.gold : 'transparent',
          backgroundColor: `${preset.accent}33`,
        },
      ]}
    >
      <Text style={{ fontSize: EMOJI[size] }}>{preset.emoji}</Text>
    </View>
  );
}

/** "아이 추가" 자리 - 아바타와 같은 크기의 점선 원. */
export function AddChildAvatar({ size = 'md' }: { size?: ChildAvatarSize }) {
  const diameter = DIAMETER[size];
  return (
    <View style={[styles.frame, styles.addFrame, { width: diameter, height: diameter }]}>
      <Icon name="plus" size={Math.round(EMOJI[size] * 0.8)} color={storybookTheme.color.onContent} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: storybookTheme.radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addFrame: {
    borderStyle: 'dashed',
    borderColor: storybookTheme.color.contentPanelBorder,
    backgroundColor: storybookTheme.color.contentPanel,
  },
});
