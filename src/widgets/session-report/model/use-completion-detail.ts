import { useCallback, useEffect, useState } from 'react';

import {
  getStoryCompletion,
  retryReportAnalysis,
  type StoryCompletionDetail,
} from '@/entities/story-completion';

const POLL_MS = 4_000;
const MAX_POLLS = 30;

/**
 * 완주 기록 상세를 불러오고, 서버 분석(관심·대화 카드)이 아직 만들어지는 중이면 몇 초마다 다시 본다(Q-39).
 * 분석이 끝나거나(READY·FAILED·SKIPPED) 2분쯤 지나면 멈춘다. retry는 실패한 분석만 다시 만들게 한다.
 */
export function useCompletionDetail(token: string | null, completionId: string | null) {
  const [detail, setDetail] = useState<StoryCompletionDetail | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token || !completionId) return;
    let cancelled = false;
    let polls = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const load = () => {
      polls += 1;
      getStoryCompletion(token, completionId)
        .then((loaded) => {
          if (cancelled) return;
          setDetail(loaded);
          const pending = !loaded.analysis || loaded.analysis.status === 'PENDING';
          if (pending && polls < MAX_POLLS) timer = setTimeout(load, POLL_MS);
        })
        .catch(() => {
          if (!cancelled && polls < MAX_POLLS) timer = setTimeout(load, POLL_MS);
        });
    };
    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [attempt, completionId, token]);

  const retry = useCallback(async () => {
    if (!token || !completionId) return;
    setDetail((current) =>
      current?.analysis ? { ...current, analysis: { ...current.analysis, status: 'PENDING' } } : current,
    );
    await retryReportAnalysis(token, completionId).catch(() => {});
    setAttempt((value) => value + 1);
  }, [completionId, token]);

  return { detail: completionId && detail?.id === completionId ? detail : null, setDetail, retry };
}
