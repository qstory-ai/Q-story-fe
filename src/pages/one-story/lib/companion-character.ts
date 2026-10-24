/**
 * 그레텔 대화(Q-31) 상대 캐릭터. 질문 초대를 그레텔이 하므로 대화 상대도 그레텔로 고정한다
 * (GRETEL_COMPANION). 헨젤 정보는 다른 이야기 친구가 필요해질 때를 위해 남겨 둔다.
 *
 * 아바타는 캐릭터 시트(피그마 「삽화」 등장인물) 정면 얼굴을 잘라 둔 전용 그림(public/avatars)이다. 예전에는
 * 장면 삽화에서 얼굴 위치를 숫자로 잘라 썼는데, 삽화가 스타일 01로 바뀌자 엉뚱한 곳이 잘렸다(10/24 QA).
 */
export type CompanionCharacter = {
  speakerId: string;
  displayName: string;
  avatarImageUri: string;
};

const avatar = (name: string) => `${import.meta.env.BASE_URL}avatars/${name}.webp`;

const COMPANION_CHARACTERS: readonly CompanionCharacter[] = [
  { speakerId: 'HG-SPK-HANSEL', displayName: '헨젤', avatarImageUri: avatar('hansel') },
  { speakerId: 'HG-SPK-GRETEL', displayName: '그레텔', avatarImageUri: avatar('gretel') },
];

/** Q-31: 그레텔 대화의 상대는 그레텔로 고정한다 - 질문 초대도 그레텔이 하므로 같은 인물이 이어 간다. */
export const GRETEL_COMPANION: CompanionCharacter = COMPANION_CHARACTERS[1];
