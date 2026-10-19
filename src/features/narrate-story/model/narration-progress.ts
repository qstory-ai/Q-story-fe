/**
 * 바깥(자막·장면 진행 막대)에 보이는 지금 대사의 진행률(0~1).
 *
 * 자막은 captionRequestId 대사를 진행률로 잘라 보인다. 대사가 끝나 다음 대사를 준비하는 동안 자막은 아직 앞 대사인데
 * 진행률만 0으로 돌아가면, 두 줄로 나뉜 긴 대사의 첫 줄이 잠깐 다시 뜬다(10/19 QA). 그래서
 * - 소리가 없는 대사 사이, 또는 고정 낭독 진행률이 다른 대사(곧 재생할 다음 대사)의 것이면 앞 대사의 끝(1)으로 본다.
 */
export function exposedNarrationProgress({
  activeSource,
  fixedProgress,
  fixedProgressRequestId,
  captionRequestId,
  liveProgress,
  deviceProgress,
}: {
  activeSource: 'fixed' | 'live' | 'device' | null;
  fixedProgress: number;
  fixedProgressRequestId: string | null;
  captionRequestId: string | null;
  liveProgress: number;
  deviceProgress: number;
}): number {
  if (activeSource === 'fixed') {
    return fixedProgressRequestId === captionRequestId ? fixedProgress : 1;
  }
  if (activeSource === 'live') return liveProgress;
  if (activeSource === 'device') return deviceProgress;
  return 1;
}
