/**
 * "/stories/:storyId/play?childId=" 로 들어왔을 때 플레이어를 띄우기 전에 할 일. 플레이어는 전역 선택 아이
 * (ChildrenProvider.selectedChild)로 이름을 부르고 완주를 기록하며, 이름은 마운트 순간에 한 번 읽는다 -
 * 그래서 선택을 맞춘 뒤에만 플레이어를 마운트한다.
 *
 * - wait: 아이 목록을 아직 불러오는 중
 * - select: 전역 선택을 이 아이로 바꾼 뒤 다시 판단
 * - ready: 플레이어를 띄워도 된다(요청이 없거나, 보호자가 아니거나, 목록에 없는 아이면 지금 선택 그대로)
 */
export type PlayerChildSync = { kind: 'wait' } | { kind: 'select'; childId: string } | { kind: 'ready' };

export function playerChildSync({
  requestedChildId,
  isParent,
  childrenLoading,
  childIds,
  selectedChildId,
}: {
  requestedChildId: string | null;
  isParent: boolean;
  childrenLoading: boolean;
  childIds: readonly string[];
  selectedChildId: string | null;
}): PlayerChildSync {
  if (!requestedChildId || !isParent) return { kind: 'ready' };
  if (childrenLoading) return { kind: 'wait' };
  if (!childIds.includes(requestedChildId) || selectedChildId === requestedChildId) return { kind: 'ready' };
  return { kind: 'select', childId: requestedChildId };
}
