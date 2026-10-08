/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ClassHistoryEntry } from '../api/class-lifecycle-api';
import {
  archivedClassBanner,
  archivedOnLabel,
  classHistoryRows,
  lifecycleFailureMessage,
  movedToClassName,
  pastMemberLabel,
  skipReasonLabel,
  skippedStudentLines,
  termResultSummary,
} from './lifecycle-copy';
import {
  buildTermTransitionRequest,
  canArchiveAfterTransition,
  initialTermChoices,
  summarizeTermChoices,
  termChoiceSummaryLines,
  type TermChoices,
} from './term-transition';

const IDS = ['s1', 's2', 's3'];
const NAMES = { s1: '하윤', s2: '도윤', s3: '서아' };

test('처음엔 모두 "이 반에 그대로"이고, 그대로가 있으면 보관할 수 없다', () => {
  const choices = initialTermChoices(IDS);
  assert.deepEqual(Object.values(choices).map((choice) => choice.action), ['KEEP', 'KEEP', 'KEEP']);
  assert.equal(canArchiveAfterTransition(IDS, choices), false);
  const decided: TermChoices = { s1: { action: 'GRADUATE' }, s2: { action: 'MOVE', targetClassId: 'c2' }, s3: { action: 'GRADUATE' } };
  assert.equal(canArchiveAfterTransition(IDS, decided), true);
  assert.equal(canArchiveAfterTransition(IDS, { ...decided, s3: { action: 'KEEP' } }), false);
  // 명단에 있는데 선택이 빠진 학생은 그대로로 본다.
  assert.equal(canArchiveAfterTransition(IDS, { s1: { action: 'GRADUATE' } }), false);
  assert.equal(canArchiveAfterTransition([], {}), true);
});

test('요청은 학생마다 정확히 한 번 - 고르지 않은 학생은 그대로로 들어간다', () => {
  const built = buildTermTransitionRequest({
    sourceClassId: 'c1',
    studentIds: [...IDS, 's1'],
    choices: { s1: { action: 'MOVE', targetClassId: 'c2' }, s2: { action: 'GRADUATE' } },
    archiveClass: false,
  });
  assert.equal(built.ok, true);
  if (!built.ok) return;
  assert.deepEqual(built.request, {
    archiveClass: false,
    decisions: [
      { studentId: 's1', action: 'MOVE', targetClassId: 'c2' },
      { studentId: 's2', action: 'GRADUATE' },
      { studentId: 's3', action: 'KEEP' },
    ],
  });
});

test('다음 반을 고르지 않았거나 지금 반을 고르면 막는다', () => {
  const noTarget = buildTermTransitionRequest({
    sourceClassId: 'c1',
    studentIds: IDS,
    choices: { s2: { action: 'MOVE', targetClassId: null } },
    archiveClass: false,
    nameById: NAMES,
  });
  assert.deepEqual(noTarget, { ok: false, studentId: 's2', message: '도윤의 다음 반을 골라 주세요.' });
  const same = buildTermTransitionRequest({
    sourceClassId: 'c1',
    studentIds: IDS,
    choices: { s1: { action: 'MOVE', targetClassId: 'c1' } },
    archiveClass: false,
  });
  assert.equal(same.ok, false);
});

test('그대로 남는 학생이 있으면 보관과 함께 보낼 수 없다', () => {
  const built = buildTermTransitionRequest({
    sourceClassId: 'c1',
    studentIds: IDS,
    choices: { s1: { action: 'GRADUATE' }, s2: { action: 'GRADUATE' } },
    archiveClass: true,
  });
  assert.deepEqual(built, { ok: false, message: '이 반에 그대로 남는 학생이 있으면 지난 반으로 보관할 수 없어요.' });
  const ok = buildTermTransitionRequest({
    sourceClassId: 'c1',
    studentIds: IDS,
    choices: { s1: { action: 'GRADUATE' }, s2: { action: 'GRADUATE' }, s3: { action: 'MOVE', targetClassId: 'c2' } },
    archiveClass: true,
  });
  assert.equal(ok.ok && ok.request.archiveClass, true);
});

test('확인 단계 요약 - 옮길 반별 인원, 그대로, 수료', () => {
  const summary = summarizeTermChoices(
    ['s1', 's2', 's3', 's4'],
    { s1: { action: 'MOVE', targetClassId: 'c2' }, s2: { action: 'MOVE', targetClassId: 'c2' }, s3: { action: 'GRADUATE' } },
    { c2: '햇살반' },
  );
  assert.deepEqual(termChoiceSummaryLines(summary), ['햇살반으로 옮김 2명', '이 반에 그대로 1명', '수료 1명']);
  assert.equal(summary.move, 2);
});

test('옮기지 못한 이유는 한국어로, 모르는 값은 공통 문장', () => {
  assert.equal(skipReasonLabel('NOT_IN_CLASS'), '이미 이 반 학생이 아니에요');
  assert.equal(skipReasonLabel('GRADUATED'), '이미 수료한 학생이에요');
  assert.equal(skipReasonLabel('SAME_CLASS'), '옮길 반이 지금 반과 같아요');
  assert.equal(skipReasonLabel('ALREADY_IN_TARGET'), '옮길 반에 같은 아이가 이미 있어요');
  assert.equal(skipReasonLabel('ALREADY_TUTOR_STUDENT'), '옮길 반 담임 선생님 명단에 같은 아이가 이미 있어요');
  assert.equal(skipReasonLabel('SOMETHING_NEW'), '옮기지 못했어요');
  assert.deepEqual(
    skippedStudentLines(
      [
        { studentId: 's1', reason: 'GRADUATED' },
        { studentId: 'x', reason: 'SAME_CLASS' },
      ],
      NAMES,
    ),
    ['하윤 · 이미 수료한 학생이에요', '한 학생 · 옮길 반이 지금 반과 같아요'],
  );
});

test('지난 반 안내 문구', () => {
  assert.equal(
    archivedClassBanner('2026-10-08T03:00:00Z'),
    '지난 반이에요 · 2026년 10월 8일에 보관했어요. 기록과 리포트는 그대로 볼 수 있어요.',
  );
  // 한국 시간 기준 날짜 - UTC 저녁은 다음 날.
  assert.equal(archivedOnLabel('2026-02-27T16:00:00Z'), '2026년 2월 28일 보관');
  assert.equal(archivedClassBanner(null), '지난 반이에요. 기록과 리포트는 그대로 볼 수 있어요.');
});

test('지난 학생 라벨 - 수료 / 옮긴 반', () => {
  assert.equal(pastMemberLabel({ endReason: 'GRADUATED', graduatedAt: '2026-10-08T00:00:00Z' }), '수료');
  assert.equal(pastMemberLabel({ endReason: 'MOVED', graduatedAt: null }, '꽃잎반'), '꽃잎반으로 옮김');
  assert.equal(pastMemberLabel({ endReason: 'MOVED', graduatedAt: null }), '다른 반으로 옮김');
});

const HISTORY: ClassHistoryEntry[] = [
  { classId: 'c2', className: '햇살반', classArchived: false, startedAt: '2026-10-08T00:00:00Z', endedAt: null, reason: 'MOVED', endReason: null },
  { classId: 'c1', className: '새싹반', classArchived: true, startedAt: '2026-03-02T00:00:00Z', endedAt: '2026-08-31T00:00:00Z', reason: 'JOINED', endReason: 'KEPT' },
  { classId: 'c1', className: '새싹반', classArchived: true, startedAt: '2026-08-31T00:00:00Z', endedAt: '2026-10-08T00:00:00Z', reason: 'KEPT', endReason: 'MOVED' },
];

test('반 이력 - 옮겨 간 반 이름과 최신이 위인 줄', () => {
  assert.equal(movedToClassName(HISTORY, 'c1'), '햇살반');
  assert.equal(movedToClassName(HISTORY, 'c2'), null);
  const rows = classHistoryRows(HISTORY);
  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map((row) => [row.className, row.current, row.note]),
    [
      ['햇살반', true, '다른 반에서 옮겨 옴'],
      ['새싹반', false, '반 코드로 들어옴 · 햇살반으로 옮김'],
    ],
  );
  assert.equal(rows[1].period, '2026년 3월 2일 ~ 2026년 10월 8일');
  assert.equal(rows[0].period, '2026년 10월 8일 ~ 지금');
});

test('학기 마무리 결과 요약과 실패 문장', () => {
  assert.equal(
    termResultSummary({ moved: ['a', 'b'], kept: [], graduated: ['c'], archived: true }),
    '2명 옮김 · 1명 수료 · 이 반을 지난 반으로 보관했어요',
  );
  assert.equal(termResultSummary({ moved: [], kept: [], graduated: [], archived: false }), '바뀐 학생이 없어요');
  assert.equal(lifecycleFailureMessage({ status: 409, message: '아직 이 반에 학생이 있어요.' }, 'x'), '아직 이 반에 학생이 있어요.');
  assert.equal(lifecycleFailureMessage({ status: 500, message: 'boom' }, 'x'), 'x');
  assert.equal(lifecycleFailureMessage({ status: 409, message: '' }, 'x'), 'x');
});
