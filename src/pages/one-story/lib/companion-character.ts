import { STORY_IMAGE_ASSETS_BY_ID } from '@/entities/story/model/story-assets.generated';

/**
 * 그레텔 대화(Q-31) 상대 캐릭터. 질문 초대를 그레텔이 하므로 대화 상대도 그레텔로 고정한다
 * (GRETEL_COMPANION). 헨젤 정보는 다른 이야기 친구가 필요해질 때를 위해 남겨 둔다.
 *
 * 아바타는 둘 다 같은 장면 일러스트(hg-art-18-home-apology-v2.webp, 1586x992)에 나란히
 * 서 있는 걸 이용해 얼굴 부분만 다르게 크롭한다 - 캐릭터별 초상화 에셋이 아직 없기 때문.
 * avatarFrame(64x64) 안에서 이미지를 avatarRenderSize로 확대해 avatarOffset만큼
 * 이동시키면 얼굴이 프레임 중앙에 온다. 정확한 위치는 브라우저에서 실제로 렌더링해보고
 * 튜닝했다.
 */
export type CompanionCharacter = {
  speakerId: string;
  displayName: string;
  avatarImageUri: string;
  avatarRenderSize: { width: number; height: number };
  avatarOffset: { left: number; top: number };
};

const AVATAR_IMAGE_URI = STORY_IMAGE_ASSETS_BY_ID.HG['home-promise'].uri;
const AVATAR_RENDER_SIZE = { width: 508, height: 317 };

const COMPANION_CHARACTERS: readonly CompanionCharacter[] = [
  {
    speakerId: 'HG-SPK-HANSEL',
    displayName: '헨젤',
    avatarImageUri: AVATAR_IMAGE_URI,
    avatarRenderSize: AVATAR_RENDER_SIZE,
    avatarOffset: { left: -69, top: -54 },
  },
  {
    speakerId: 'HG-SPK-GRETEL',
    displayName: '그레텔',
    avatarImageUri: AVATAR_IMAGE_URI,
    avatarRenderSize: AVATAR_RENDER_SIZE,
    avatarOffset: { left: -126, top: -67 },
  },
];

/** Q-31: 그레텔 대화의 상대는 그레텔로 고정한다 - 질문 초대도 그레텔이 하므로 같은 인물이 이어 간다. */
export const GRETEL_COMPANION: CompanionCharacter = COMPANION_CHARACTERS[1];
