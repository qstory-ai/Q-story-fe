/**
 * 컴패니언 챗(이야기 밖에서 살짝) 상대 캐릭터. 헨젤과 그레텔 둘 다 이야기 내내 등장하는
 * 주인공 남매라 누가 뽑혀도 아이가 어색함 없이 대화할 수 있다 - 마녀/새엄마처럼 부정적인
 * 캐릭터는 대상에서 제외한다. 이야기 세션(useCompanionChat 훅 하나의 lifetime)당 한 번만
 * 뽑고 그 뒤로는 고정한다 - 대화 도중 상대가 바뀌면 버튼 라벨과 대화창 안 이름이 어긋난다.
 *
 * 아바타는 둘 다 같은 장면 일러스트(hg-art-18-home-apology-v2.jpg, 1586x992)에 나란히
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

const AVATAR_IMAGE_URI = '/story/hansel-gretel/illustrations/hg-art-18-home-apology-v2.jpg';
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

export function pickRandomCompanionCharacter(): CompanionCharacter {
  const index = Math.floor(Math.random() * COMPANION_CHARACTERS.length);
  return COMPANION_CHARACTERS[index];
}