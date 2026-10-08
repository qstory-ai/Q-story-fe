export type DemoSyncDecision = 'sync' | 'discard';

/**
 * 익명 데모 기록을 로그인한 계정으로 옮겨도 되는지 - 순수 함수.
 * childId가 없는 기록(진짜 익명 데모)은 옮기고, 있으면 로그인한 사용자의 아이일 때만 옮긴다.
 * 그 밖(다른 계정의 기록, 보호자가 아닌 계정)은 버린다 - 남의 아이 이름으로 리포트가 저장되지 않게.
 */
export function decideDemoSync(
  record: { childId?: string | null },
  ownChildIds: readonly string[],
): DemoSyncDecision {
  if (!record.childId) return 'sync';
  return ownChildIds.includes(record.childId) ? 'sync' : 'discard';
}
