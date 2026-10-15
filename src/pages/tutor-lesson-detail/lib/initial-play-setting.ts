import type { PlaySetting } from '@/entities/play-session';
import type { StoryCompletionSummary } from '@/entities/story-completion';

/**
 * 수업 상세를 열 때 진행 형태의 처음 값. 이 수업의 가장 최근 기록이 개별 수업(TUTOR)이면 개별, 아니면 전체 반 -
 * 개별로 진행한 수업을 다시 열었는데 "전체 반"으로 돌아가 있지 않게 한다.
 */
export function initialPlaySetting(
  completions: readonly Pick<StoryCompletionSummary, 'sessionKind' | 'completedAt'>[],
): PlaySetting {
  const latest = completions.reduce<(typeof completions)[number] | null>(
    (best, current) => (best == null || Date.parse(current.completedAt) > Date.parse(best.completedAt) ? current : best),
    null,
  );
  return latest?.sessionKind === 'TUTOR' ? 'INDIVIDUAL' : 'WHOLE_CLASS';
}
