import { useCallback, useEffect, useRef } from 'react';

import { trackBetaEvent } from '@/entities/analytics';

import { reportViewedMetadata, type ReportViewSource, type SessionReportAction } from '../lib/report-tracking';

/**
 * 리포트 열람·조작 통계(Q-40 UT). report_viewed는 리포트(기록 id)마다 한 번 - 기록 id가 아직 없으면
 * `ready`가 될 때까지 기다린다. 돌려주는 함수는 SessionReport의 onAction에 그대로 넘긴다.
 */
export function useReportTracking({
  kind,
  source,
  completionId,
  viewerRole,
  ready = true,
}: {
  kind: string | null | undefined;
  source: ReportViewSource;
  completionId: string | null | undefined;
  viewerRole: string | null | undefined;
  ready?: boolean;
}) {
  const sentFor = useRef<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    const key = completionId ?? '(none)';
    if (sentFor.current === key) return;
    sentFor.current = key;
    void trackBetaEvent('report_viewed', reportViewedMetadata({ kind, source, completionId, viewerRole }));
  }, [completionId, kind, ready, source, viewerRole]);

  return useCallback(
    (action: SessionReportAction) => {
      void trackBetaEvent('report_action', { action, kind: kind ?? null, completion_id: completionId ?? null });
    },
    [completionId, kind],
  );
}
