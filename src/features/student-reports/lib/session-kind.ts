/** 리포트 목록의 기록 구분 - 반 수업은 반이 함께 읽은 한 건, 개별 수업은 아이 한 명과 읽은 한 건. */
export function sessionKindLabel(kind: 'CLASS' | 'TUTOR' | 'HOME' | string): string {
  if (kind === 'CLASS') return '반 수업';
  if (kind === 'TUTOR') return '개별 수업';
  return '집에서 읽음';
}
