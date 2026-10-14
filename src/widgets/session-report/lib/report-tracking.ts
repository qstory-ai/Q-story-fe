import type { BetaMetadataInput } from '@/entities/analytics';

/** 리포트를 연 곳(Q-40 UT) - 방금 끝난 회차·지난 기록·알림·홈 카드. */
export type ReportViewSource = 'live' | 'history' | 'notification' | 'home_card';

/** 리포트에서 누른 것 - report_action 통계의 action 값. */
export type SessionReportAction =
  | 'expand_dialogue'
  | 'expand_reason'
  | 'retry_analysis'
  | 'reread_click'
  | 'teacher_note_saved';

export type ReportKind = 'HOME' | 'CLASS' | 'TUTOR';

/** 리포트 주소의 `from=`로 연 곳을 정한다 - 모르는 값이면 지난 기록 목록에서 연 것으로 본다. */
export function reportViewSourceFrom(from: string | null | undefined): ReportViewSource {
  return from === 'notification' || from === 'home_card' ? from : 'history';
}

export function reportViewedMetadata(input: {
  kind: ReportKind | string | null | undefined;
  source: ReportViewSource;
  completionId: string | null | undefined;
  viewerRole: string | null | undefined;
}): BetaMetadataInput {
  return {
    kind: input.kind ?? null,
    source: input.source,
    completion_id: input.completionId ?? null,
    viewer_role: input.viewerRole ?? null,
  };
}
