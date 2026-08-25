import type { AuthState } from '@/entities/auth';

import type { StoryCatalogEntry } from '../api/story-api';

export type StoryUnlockState = 'unlocked-free' | 'unlocked-paid' | 'locked';

/**
 * 이야기 한 편이 지금 이 호출자에게 열려 있는지 판단하는 순수 함수 - 홈 서재 그리드가
 * 카탈로그 응답과 auth 상태만으로 카드마다 잠금 상태를 계산한다.
 *
 * "로그인은 했지만 결제(구독)는 안 한" 상태는 의도적으로 비로그인과 동일하게 'locked'로
 * 취급한다 - 세 상태를 자연스럽게 읽으면 그렇게 되고, 안전한 기본값이기도 하다. 문구만
 * 다르게 하고 싶다면(예: "로그인하세요" vs "구독하세요") 호출자가 auth.status를 따로 보고
 * 갈라 쓰면 된다 - 이 함수의 반환값 자체는 그대로 세 값이면 충분하다.
 */
export function unlockStateFor(story: StoryCatalogEntry, auth: AuthState): StoryUnlockState {
  if (!story.requiresEntitlement) {
    return 'unlocked-free';
  }
  if (auth.status === 'authenticated' && auth.user.grantsAccess) {
    return 'unlocked-paid';
  }
  return 'locked';
}
