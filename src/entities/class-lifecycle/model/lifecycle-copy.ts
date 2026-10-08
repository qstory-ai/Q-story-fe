import { withDirectionParticle } from '@/shared/lib';
import type { ClassStudentResponse } from '@/entities/auth';

import type { ClassHistoryEntry, MoveSkipReason, SkippedStudent } from '../api/class-lifecycle-api';

/** 날짜는 한국 시간으로 - "2026년 10월 8일". */
const DATE_FORMAT = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' });

export function formatLifecycleDate(iso: string): string {
  return DATE_FORMAT.format(new Date(iso));
}

/** 반 상세 위 읽기 전용 안내 - 기록과 리포트는 그대로 볼 수 있다. */
export function archivedClassBanner(archivedAt: string | null | undefined): string {
  if (!archivedAt) return '지난 반이에요. 기록과 리포트는 그대로 볼 수 있어요.';
  return `지난 반이에요 · ${formatLifecycleDate(archivedAt)}에 보관했어요. 기록과 리포트는 그대로 볼 수 있어요.`;
}

/** 반 목록의 지난 반 한 줄 - "2026년 10월 8일 보관". */
export function archivedOnLabel(archivedAt: string | null | undefined): string {
  return archivedAt ? `${formatLifecycleDate(archivedAt)} 보관` : '보관됨';
}

const SKIP_REASON_LABEL: Record<MoveSkipReason, string> = {
  NOT_IN_CLASS: '이미 이 반 학생이 아니에요',
  GRADUATED: '이미 수료한 학생이에요',
  SAME_CLASS: '옮길 반이 지금 반과 같아요',
  ALREADY_IN_TARGET: '옮길 반에 같은 아이가 이미 있어요',
  ALREADY_TUTOR_STUDENT: '옮길 반 담임 선생님 명단에 같은 아이가 이미 있어요',
};

/** 옮기지 못한 이유를 화면 문장으로. 모르는 값이면 공통 문장. */
export function skipReasonLabel(reason: string): string {
  return SKIP_REASON_LABEL[reason as MoveSkipReason] ?? '옮기지 못했어요';
}

/** "하윤 · 이미 수료한 학생이에요" 줄들 - 이름을 모르면 "한 학생". */
export function skippedStudentLines(skipped: readonly SkippedStudent[], nameById: Record<string, string>): string[] {
  return skipped.map((entry) => `${nameById[entry.studentId] ?? '한 학생'} · ${skipReasonLabel(entry.reason)}`);
}

/** 지금 학생이 아니고 이 반을 떠난 줄인가(includePast로 붙은 줄). */
export function isPastMember(student: Pick<ClassStudentResponse, 'endedAt'>): boolean {
  return Boolean(student.endedAt);
}

/** 지난 학생 라벨 - "수료" / "햇살반으로 옮김"(옮긴 반 이름을 모르면 "다른 반으로 옮김"). */
export function pastMemberLabel(
  student: Pick<ClassStudentResponse, 'endReason' | 'graduatedAt'>,
  movedToClassName?: string | null,
): string {
  if (student.endReason === 'GRADUATED' || (!student.endReason && student.graduatedAt)) return '수료';
  if (student.endReason === 'MOVED') return movedToClassName ? `${withDirectionParticle(movedToClassName)} 옮김` : '다른 반으로 옮김';
  return '이 반을 떠남';
}

/** 반 이력에서 이 반을 떠나 옮겨 간 반 이름 - 이 반 구간이 MOVED로 끝난 바로 다음 구간. 없으면 null. */
export function movedToClassName(history: readonly ClassHistoryEntry[], fromClassId: string): string | null {
  const sorted = [...history].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const entry = sorted[index];
    if (entry.classId !== fromClassId || entry.endReason !== 'MOVED') continue;
    const next = sorted.slice(index + 1).find((candidate) => candidate.classId !== fromClassId);
    return next?.className ?? null;
  }
  return null;
}

export type ClassHistoryRow = {
  classId: string;
  className: string;
  archived: boolean;
  current: boolean;
  /** "2026년 3월 2일 ~ 지금" */
  period: string;
  /** "반 코드로 들어옴 · 햇살반으로 옮김" 같은 시작·끝 설명. */
  note: string;
};

const START_LABEL: Record<string, string> = { JOINED: '반 코드로 들어옴', MOVED: '다른 반에서 옮겨 옴', KEPT: '이어서 다님' };

/**
 * 학생 상세의 반 이력 - 최신이 위. 학기 마무리에서 "그대로"를 고르면 같은 반 구간이 KEPT로 끊겼다 이어지므로 한 줄로 합친다.
 */
export function classHistoryRows(history: readonly ClassHistoryEntry[]): ClassHistoryRow[] {
  const sorted = [...history].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  const merged: ClassHistoryEntry[] = [];
  for (const entry of sorted) {
    const last = merged.at(-1);
    if (last && last.classId === entry.classId && last.endReason === 'KEPT') {
      merged[merged.length - 1] = { ...last, endedAt: entry.endedAt, endReason: entry.endReason };
    } else {
      merged.push(entry);
    }
  }
  return merged
    .map((entry, index) => {
      const next = merged[index + 1];
      const end =
        entry.endReason === 'GRADUATED' ? '수료'
        : entry.endReason === 'MOVED' ? (next ? `${withDirectionParticle(next.className)} 옮김` : '다른 반으로 옮김')
        : null;
      return {
        classId: entry.classId,
        className: entry.className,
        archived: entry.classArchived,
        current: entry.endedAt === null,
        period: `${formatLifecycleDate(entry.startedAt)} ~ ${entry.endedAt ? formatLifecycleDate(entry.endedAt) : '지금'}`,
        note: [START_LABEL[entry.reason] ?? null, end].filter(Boolean).join(' · '),
      };
    })
    .reverse();
}

/** 학기 마무리 결과 한 줄 요약 - "2명 옮김 · 1명 그대로 · 3명 수료 · 지난 반으로 보관했어요". */
export function termResultSummary(result: { moved: readonly string[]; kept: readonly string[]; graduated: readonly string[]; archived: boolean }): string {
  const parts = [
    result.moved.length > 0 ? `${result.moved.length}명 옮김` : null,
    result.kept.length > 0 ? `${result.kept.length}명 그대로` : null,
    result.graduated.length > 0 ? `${result.graduated.length}명 수료` : null,
  ].filter(Boolean);
  const head = parts.length > 0 ? parts.join(' · ') : '바뀐 학생이 없어요';
  return result.archived ? `${head} · 이 반을 지난 반으로 보관했어요` : head;
}

/**
 * 서버 실패 문장 - 반 수명주기 실패는 서버가 이유(남은 학생, 지난 반, 빠진 학생 등)를 safeDetail로 나눠 주므로
 * 그 문장을 먼저 쓴다. 없으면 fallback.
 */
export function lifecycleFailureMessage(failure: unknown, fallback: string): string {
  const detail = (failure as { message?: unknown } | null)?.message;
  const status = (failure as { status?: unknown } | null)?.status;
  if (typeof status === 'number' && status >= 400 && status < 500 && typeof detail === 'string' && detail.trim()) return detail.trim();
  return fallback;
}
