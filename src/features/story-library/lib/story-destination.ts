import type { AuthState } from '@/entities/auth';
import { DEFAULT_BETA_STORY_ID, unlockStateFor, type StoryCatalogEntry } from '@/entities/story';

/**
 * 이야기 카드를 눌렀을 때의 목적지 - 홈/서재/선생님 서재/공용 그리드가 모두 이 함수를 쓴다(스펙 §2-4).
 * 로그인 상태에선 체험 이야기(HG)도 상세로 보낸다: /demo는 비로그인 체험용이라 연락처 수집 창이 뜬다.
 */
export function storyDestination(story: StoryCatalogEntry, auth: AuthState): string {
  const detail = `/stories/${story.storyId}`;
  const locked = unlockStateFor(story, auth) === 'locked';
  if (auth.status !== 'authenticated') {
    if (locked) return `/login?next=${encodeURIComponent(detail)}`;
    return story.storyId === DEFAULT_BETA_STORY_ID ? '/demo' : detail;
  }
  return locked ? '/mypage/subscription' : detail;
}
