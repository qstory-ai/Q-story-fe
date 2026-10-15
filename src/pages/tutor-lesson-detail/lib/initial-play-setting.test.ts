/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { initialPlaySetting } from './initial-play-setting';

test('기록이 없으면 전체 반으로 시작한다', () => {
  assert.equal(initialPlaySetting([]), 'WHOLE_CLASS');
});

test('가장 최근 기록이 개별 수업이면 다시 열어도 개별로 고른다', () => {
  assert.equal(
    initialPlaySetting([
      { sessionKind: 'CLASS', completedAt: '2026-10-15T07:00:00Z' },
      { sessionKind: 'TUTOR', completedAt: '2026-10-15T07:46:00Z' },
    ]),
    'INDIVIDUAL',
  );
});

test('가장 최근 기록이 반 수업이면 전체 반', () => {
  assert.equal(
    initialPlaySetting([
      { sessionKind: 'CLASS', completedAt: '2026-10-15T08:00:00Z' },
      { sessionKind: 'TUTOR', completedAt: '2026-10-15T07:46:00Z' },
    ]),
    'WHOLE_CLASS',
  );
});
