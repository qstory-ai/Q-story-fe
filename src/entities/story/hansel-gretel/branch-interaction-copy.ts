const BRANCH_INTERACTION_COPY = {
  A_OBSERVE_BIRD: {
    text: '좋아, 우리 가까이 가지 말고 하얀 새를 조용히 지켜보자.',
    audioId: 'BRIDGE-A_OBSERVE_BIRD',
  },
  A_SPEAK_TO_BIRD: {
    text: '좋아, 내가 하얀 새에게 길을 아는지 다정하게 물어볼게.',
    audioId: 'BRIDGE-A_SPEAK_TO_BIRD',
  },
  A_CHECK_SURROUNDINGS: {
    text: '좋아, 새를 따라가기 전에 주변에 남은 단서부터 찾아보자.',
    audioId: 'BRIDGE-A_CHECK_SURROUNDINGS',
  },
  A_TRY_OTHER_PATH: {
    text: '좋아, 새를 바로 따라가지 말고 다른 안전한 길도 살펴보자.',
    audioId: 'BRIDGE-A_TRY_OTHER_PATH',
  },
  B_ASK_OLD_WOMAN: {
    text: '좋아, 내가 할머니에게 이 집과 열쇠에 관해 조심스럽게 물어볼게.',
    audioId: 'BRIDGE-B_ASK_OLD_WOMAN',
  },
  B_CHECK_KEYS: {
    text: '좋아, 할머니 손에 있는 열쇠고리부터 자세히 살펴보자.',
    audioId: 'BRIDGE-B_CHECK_KEYS',
  },
  B_CHECK_HOUSE: {
    text: '좋아, 안으로 들어가기 전에 창문과 출구를 먼저 확인하자.',
    audioId: 'BRIDGE-B_CHECK_HOUSE',
  },
  B_STEP_BACK_MARK_EXIT: {
    text: '좋아, 한 걸음 물러나서 돌아갈 길을 잊지 않게 표시하자.',
    audioId: 'BRIDGE-B_STEP_BACK_MARK_EXIT',
  },
  B_MAKE_SIBLING_SIGNAL: {
    text: '좋아, 무슨 일이 생기면 바로 알 수 있게 우리끼리 신호를 정하자.',
    audioId: 'BRIDGE-B_MAKE_SIBLING_SIGNAL',
  },
  C_ASK_DEMONSTRATION: {
    text: '좋아, 내가 모르는 척하면서 마녀에게 먼저 보여 달라고 해볼게.',
    audioId: 'BRIDGE-C_ASK_DEMONSTRATION',
  },
  C_DISTRACT_AND_TAKE_KEYS: {
    text: '좋아, 마녀의 시선을 다른 곳으로 돌리고 열쇠를 챙길 기회를 찾아보자.',
    audioId: 'BRIDGE-C_DISTRACT_AND_TAKE_KEYS',
  },
  C_USE_SIGNAL: {
    text: '좋아, 문 앞에서 헨젤과 나눈 약속대로 두 번 두드리는 신호를 보낼게.',
    audioId: 'BRIDGE-C_USE_SIGNAL',
  },
  C_CHECK_LOCK_FROM_DISTANCE: {
    text: '좋아, 위험하게 다가가지 말고 멀리서 자물쇠 상태를 확인하자.',
    audioId: 'BRIDGE-C_CHECK_LOCK_FROM_DISTANCE',
  },
  C_BLOCK_PURSUIT_SAFELY: {
    text: '좋아, 아무도 다치지 않게 문과 주변 물건으로 마녀를 늦춰보자.',
    audioId: 'BRIDGE-C_BLOCK_PURSUIT_SAFELY',
  },
} as const;

export type BranchInteractionFamilyId = keyof typeof BRANCH_INTERACTION_COPY;

export function branchInteractionCopy(familyId: string) {
  return BRANCH_INTERACTION_COPY[
    familyId as BranchInteractionFamilyId
  ] ?? {
    text: '좋아, 우리가 고른 방법으로 조심스럽게 해보자.',
    audioId: null,
  };
}

export const branchInteractionEntries = Object.entries(
  BRANCH_INTERACTION_COPY,
).map(([familyId, copy]) => ({
  familyId,
  ...copy,
}));
