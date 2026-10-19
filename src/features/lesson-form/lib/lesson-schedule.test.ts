/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  computeRecurringDates,
  defaultFirstLessonInput,
  describeOneOff,
  describeRecurrence,
  formatDateTimeForInput,
  joinDateTimeInput,
  parseDateTime,
  parseLessonDateTime,
  splitDateTimeInput,
} from './lesson-schedule';

const local = (iso: string) => new Date(iso);

test('기본 정기 수업은 첫 수업 요일로 매주 12회', () => {
  // 2026-10-08은 목요일.
  const dates = computeRecurringDates({ firstLesson: '2026-10-08 15:00', count: 12 });
  assert.equal(dates.length, 12);
  for (const iso of dates) {
    assert.equal(local(iso).getDay(), 4);
    assert.equal(local(iso).getHours(), 15);
  }
  assert.equal(formatDateTimeForInput(dates[0]), '2026-10-08 15:00');
  assert.equal(formatDateTimeForInput(dates[11]), '2026-12-24 15:00');
  assert.equal(describeRecurrence(dates, null), '매주 목요일 15:00 · 12회 (10월 8일 ~ 12월 24일)');
});

test('요일을 여러 개 고르면 첫 수업 이후 그 요일마다', () => {
  const dates = computeRecurringDates({ firstLesson: '2026-10-08 09:30', count: 4, weekdays: new Set([2, 4]) });
  assert.deepEqual(dates.map(formatDateTimeForInput), [
    '2026-10-08 09:30', '2026-10-13 09:30', '2026-10-15 09:30', '2026-10-20 09:30',
  ]);
  assert.equal(describeRecurrence(dates, new Set([4, 2])), '매주 화·목요일 09:30 · 4회 (10월 8일 ~ 10월 20일)');
});

test('종료일을 주면 그날까지(포함)', () => {
  const dates = computeRecurringDates({ firstLesson: '2026-10-08 15:00', count: 12, endDate: '2026-10-22' });
  assert.deepEqual(dates.map(formatDateTimeForInput), ['2026-10-08 15:00', '2026-10-15 15:00', '2026-10-22 15:00']);
});

test('회차는 60회를 넘지 않고, 틀린 입력은 빈 목록', () => {
  assert.equal(computeRecurringDates({ firstLesson: '2026-10-08 15:00', count: 500 }).length, 60);
  assert.deepEqual(computeRecurringDates({ firstLesson: '2026-10-08 15:00', count: 0 }), []);
  assert.deepEqual(computeRecurringDates({ firstLesson: '10/8 오후 3시', count: 12 }), []);
  assert.deepEqual(computeRecurringDates({ firstLesson: '2026-10-08 15:00', count: 12, endDate: '언젠가' }), []);
});

test('텍스트 날짜 입력 파싱', () => {
  assert.equal(formatDateTimeForInput(parseLessonDateTime('2026-3-5 9:05')!.toISOString()), '2026-03-05 09:05');
  // 시각을 빼면 15:00
  assert.equal(formatDateTimeForInput(parseLessonDateTime('2026-03-05')!.toISOString()), '2026-03-05 15:00');
  assert.equal(parseLessonDateTime('2026-02-31 15:00'), null);
  assert.equal(parseLessonDateTime('2026-03-05 25:00'), null);
  assert.equal(parseDateTime('   '), null);
  assert.equal(parseDateTime('엉터리'), null);
});

test('첫 수업 기본값은 오늘 15:00', () => {
  assert.equal(defaultFirstLessonInput(new Date(2026, 9, 3, 11, 20)), '2026-10-03 15:00');
});

test('날짜·시각 선택기 값과 "YYYY-MM-DD HH:MM"을 오간다', () => {
  assert.deepEqual(splitDateTimeInput('2026-10-08 09:30'), { date: '2026-10-08', time: '09:30' });
  assert.deepEqual(splitDateTimeInput('2026-10-08'), { date: '2026-10-08', time: '15:00' });
  assert.deepEqual(splitDateTimeInput(''), { date: '', time: '' });
  assert.deepEqual(splitDateTimeInput('2026-02-31 10:00'), { date: '', time: '' });
  assert.equal(joinDateTimeInput('2026-10-08', '09:30'), '2026-10-08 09:30');
  assert.equal(joinDateTimeInput('2026-10-08', ''), '2026-10-08 15:00');
  assert.equal(joinDateTimeInput('', '09:30'), '');
  // 선택기에서 고른 값이 기존 일정 계산에 그대로 들어간다.
  const dates = computeRecurringDates({ firstLesson: joinDateTimeInput('2026-10-08', '15:00'), count: 2 });
  assert.deepEqual(dates.map(formatDateTimeForInput), ['2026-10-08 15:00', '2026-10-15 15:00']);
});

test('단발 수업 요약', () => {
  assert.equal(describeOneOff('2026-10-08 15:00'), '한 번만 · 10월 8일(목) 15:00');
  assert.equal(describeOneOff(''), '한 번만 · 일정 미정');
});
