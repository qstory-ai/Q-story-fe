import type { StoryEndStatus } from '../api/story-completion-api';

type HasEndStatus = { endStatus?: StoryEndStatus | null };

/** 중간에 나간(멈춘) 회차인지. endStatus가 없는 옛 응답은 완주로 본다. */
export function isExitedSession(item: HasEndStatus): boolean {
  return item.endStatus === 'EXITED';
}

/** 통계·"읽은 작품"에 세는 완주 회차만. */
export function completedOnly<T extends HasEndStatus>(items: readonly T[]): T[] {
  return items.filter((item) => !isExitedSession(item));
}

export const EXITED_BADGE_LABEL = '멈춤';
