import type { LocalStoryProgress } from '@/entities/analytics';
import type { AuthState } from '@/entities/auth';
import type { Child } from '@/entities/child';
import { unlockStateFor, type StoryCatalogEntry } from '@/entities/story';

import { storyDestination } from './story-destination';

/**
 * 플레이어("/stories/:storyId/play") 경로. childId는 이 재생을 기록할 아이 프로필 - StoryPlayerRoute가
 * 플레이어를 띄우기 전에 전역 선택 아이를 이 아이로 맞춘다. resume=1은 "이어서 읽기"로 들어왔다는 표시다.
 */
export function storyPlayPath(storyId: string, options: { childId?: string | null; resume?: boolean } = {}): string {
  const params = new URLSearchParams();
  if (options.childId) params.set('childId', options.childId);
  if (options.resume) params.set('resume', '1');
  const query = params.toString();
  return `/stories/${encodeURIComponent(storyId)}/play${query ? `?${query}` : ''}`;
}

export type StartDecision = { kind: 'navigate'; path: string } | { kind: 'pick-child' };

/**
 * 보호자 홈 히어로의 "이야기 시작하기" - 상세 화면을 거치지 않고 홈에서 고른 아이로 곧장 플레이어를 연다.
 * 홈에는 아이 선택기와 아이 이름이 든 버튼이 함께 보이므로 그 선택이 명시적인 선택이다. 아이가 아직
 * 없으면 등록부터, 잠겼거나 보호자가 아니면 평소 목적지(storyDestination)로 보낸다.
 */
export function startStoryFromHome({
  story,
  auth,
  children,
  selectedChildId,
}: {
  story: StoryCatalogEntry;
  auth: AuthState;
  children: readonly Child[];
  selectedChildId: string | null;
}): StartDecision {
  const isParent = auth.status === 'authenticated' && auth.user.role === 'PARENT';
  if (!isParent || unlockStateFor(story, auth) === 'locked') {
    return { kind: 'navigate', path: storyDestination(story, auth) };
  }
  if (children.length === 0) return { kind: 'pick-child' };
  const childId = children.some((child) => child.id === selectedChildId) ? selectedChildId : children[0].id;
  return { kind: 'navigate', path: storyPlayPath(story.storyId, { childId }) };
}

/**
 * "이어서 읽기" 대상 아이. 기기에 남은 진행은 한 건뿐이고 지금 선택된 아이와 다를 수 있다 - 진행을 남긴
 * 아이로 재생해야 완주 리포트도 그 아이에게 저장된다.
 * 1) 저장된 childId가 목록에 있으면 그 아이, 2) childId가 없는 이전 기록은 저장된 이름이 정확히 한 아이와
 * 맞을 때 그 아이, 3) 아이가 한 명이면 그 아이, 그 밖엔 누구 기록인지 모르니 아이를 고르게 한다.
 */
export function resumeChildId(progress: Pick<LocalStoryProgress, 'childId' | 'childName'>, children: readonly Child[]): string | null {
  if (progress.childId && children.some((child) => child.id === progress.childId)) return progress.childId;
  const name = progress.childName.trim();
  if (name) {
    const matches = children.filter((child) => child.name.trim() === name);
    if (matches.length === 1) return matches[0].id;
  }
  return children.length === 1 ? children[0].id : null;
}

export function resumeStart({
  progress,
  children,
}: {
  progress: Pick<LocalStoryProgress, 'storyId' | 'childId' | 'childName'>;
  children: readonly Child[];
}): StartDecision {
  if (children.length === 0) return { kind: 'navigate', path: storyPlayPath(progress.storyId, { resume: true }) };
  const childId = resumeChildId(progress, children);
  return childId
    ? { kind: 'navigate', path: storyPlayPath(progress.storyId, { childId, resume: true }) }
    : { kind: 'pick-child' };
}
