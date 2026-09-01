/**
 * 아이 프로필 아바타 프리셋 - 커스텀 이미지 업로드는 이번 단계 밖이라 이 표에 있는 키만
 * 유효하다. 새 아바타를 추가할 땐 여기와 (필요 시) 이모지/컬러 매핑을 함께 늘리면 된다.
 * 서버는 avatarKey 문자열만 저장하고 표시는 클라이언트가 담당한다.
 */

export type ChildAvatarKey =
  | 'fox' | 'bear' | 'rabbit' | 'owl' | 'panda' | 'lion' | 'penguin' | 'whale';

export type ChildAvatarPreset = {
  key: ChildAvatarKey;
  label: string;
  emoji: string;
  accent: string;
};

export const CHILD_AVATARS: readonly ChildAvatarPreset[] = [
  { key: 'fox', label: '여우', emoji: '🦊', accent: '#F59E42' },
  { key: 'bear', label: '곰', emoji: '🐻', accent: '#B08968' },
  { key: 'rabbit', label: '토끼', emoji: '🐰', accent: '#F1A7B4' },
  { key: 'owl', label: '올빼미', emoji: '🦉', accent: '#B69C6E' },
  { key: 'panda', label: '판다', emoji: '🐼', accent: '#7C8DA0' },
  { key: 'lion', label: '사자', emoji: '🦁', accent: '#E4B142' },
  { key: 'penguin', label: '펭귄', emoji: '🐧', accent: '#5C81B8' },
  { key: 'whale', label: '고래', emoji: '🐳', accent: '#4C8BAA' },
];

export const CHILD_AVATAR_KEYS = CHILD_AVATARS.map((preset) => preset.key);

export function findChildAvatar(key: string | null | undefined): ChildAvatarPreset {
  return CHILD_AVATARS.find((preset) => preset.key === key) ?? CHILD_AVATARS[0];
}
