import { withDirectionParticle } from '@/shared/lib';

import type { TermTransitionDecision, TermTransitionRequest } from '../api/class-lifecycle-api';

/**
 * 학기 마무리 화면의 학생별 선택 - 다음 반(MOVE, 옮길 반을 골라야 한다) / 이 반에 그대로(KEEP) / 수료(GRADUATE).
 * 처음엔 모두 "그대로"다 - 아무것도 고르지 않고 넘겨도 학생이 사라지지 않는다.
 */
export type TermChoice =
  | { action: 'KEEP' }
  | { action: 'GRADUATE' }
  | { action: 'MOVE'; targetClassId: string | null };

export type TermChoices = Record<string, TermChoice>;

export const TERM_CHOICE_LABEL: Record<TermChoice['action'], string> = {
  MOVE: '다음 반',
  KEEP: '이 반에 그대로',
  GRADUATE: '수료',
};

export function initialTermChoices(studentIds: readonly string[]): TermChoices {
  return Object.fromEntries(studentIds.map((id) => [id, { action: 'KEEP' } as TermChoice]));
}

/** 그대로 남는 학생이 하나라도 있으면 반을 보관할 수 없다(서버도 400). 학생이 없으면 보관할 수 있다. */
export function canArchiveAfterTransition(studentIds: readonly string[], choices: TermChoices): boolean {
  return studentIds.every((id) => (choices[id]?.action ?? 'KEEP') !== 'KEEP');
}

export type TermTransitionBuild =
  | { ok: true; request: TermTransitionRequest }
  | { ok: false; message: string; studentId?: string };

/**
 * 화면 선택을 서버 요청으로 바꾼다 - 학생마다 정확히 한 번, 서버가 400을 돌려줄 일을 먼저 막는다.
 * 고르지 않은 학생은 "그대로"로 본다(화면 기본값과 같다).
 */
export function buildTermTransitionRequest(input: {
  sourceClassId: string;
  studentIds: readonly string[];
  choices: TermChoices;
  archiveClass: boolean;
  /** 이름을 붙여 안내할 때 쓴다. 없으면 "한 학생"으로. */
  nameById?: Record<string, string>;
}): TermTransitionBuild {
  const { sourceClassId, studentIds, choices, archiveClass, nameById = {} } = input;
  const who = (id: string) => nameById[id] ?? '한 학생';
  const decisions: TermTransitionDecision[] = [];
  const seen = new Set<string>();
  for (const studentId of studentIds) {
    if (seen.has(studentId)) continue;
    seen.add(studentId);
    const choice = choices[studentId] ?? { action: 'KEEP' };
    if (choice.action === 'MOVE') {
      if (!choice.targetClassId) return { ok: false, studentId, message: `${who(studentId)}의 다음 반을 골라 주세요.` };
      if (choice.targetClassId === sourceClassId) {
        return { ok: false, studentId, message: `${who(studentId)}의 다음 반이 지금 반과 같아요. 그대로 두려면 "이 반에 그대로"를 골라 주세요.` };
      }
      decisions.push({ studentId, action: 'MOVE', targetClassId: choice.targetClassId });
    } else {
      decisions.push({ studentId, action: choice.action });
    }
  }
  if (archiveClass && decisions.some((decision) => decision.action === 'KEEP')) {
    return { ok: false, message: '이 반에 그대로 남는 학생이 있으면 지난 반으로 보관할 수 없어요.' };
  }
  return { ok: true, request: { decisions, archiveClass } };
}

export type TermChoiceSummary = {
  move: number;
  keep: number;
  graduate: number;
  /** 옮길 반별 인원(반 이름 순서는 처음 나온 순). */
  byTarget: { classId: string; className: string; count: number }[];
};

export function summarizeTermChoices(
  studentIds: readonly string[],
  choices: TermChoices,
  classNameById: Record<string, string>,
): TermChoiceSummary {
  const summary: TermChoiceSummary = { move: 0, keep: 0, graduate: 0, byTarget: [] };
  for (const id of studentIds) {
    const choice = choices[id] ?? { action: 'KEEP' };
    if (choice.action === 'KEEP') summary.keep += 1;
    else if (choice.action === 'GRADUATE') summary.graduate += 1;
    else {
      summary.move += 1;
      const targetId = choice.targetClassId ?? '';
      const existing = summary.byTarget.find((entry) => entry.classId === targetId);
      if (existing) existing.count += 1;
      else summary.byTarget.push({ classId: targetId, className: classNameById[targetId] ?? '고르지 않은 반', count: 1 });
    }
  }
  return summary;
}

/** 확인 단계의 요약 문장들 - "햇살반으로 2명", "그대로 1명", "수료 3명". 0명인 줄은 뺀다. */
export function termChoiceSummaryLines(summary: TermChoiceSummary): string[] {
  return [
    ...summary.byTarget.map((entry) => `${withDirectionParticle(entry.className)} 옮김 ${entry.count}명`),
    ...(summary.keep > 0 ? [`이 반에 그대로 ${summary.keep}명`] : []),
    ...(summary.graduate > 0 ? [`수료 ${summary.graduate}명`] : []),
  ];
}
