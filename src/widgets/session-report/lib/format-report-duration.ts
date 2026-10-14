export function formatReportDuration(durationSeconds: number | null) {
  if (durationSeconds === null) {
    return '기록 중';
  }
  const minutes = Math.max(1, Math.round(durationSeconds / 60));
  return `${minutes}분`;
}
