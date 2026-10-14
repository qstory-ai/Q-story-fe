/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { reportViewSourceFrom, reportViewedMetadata } from './report-tracking';

test('리포트를 연 곳은 주소의 from=으로, 모르면 지난 기록', () => {
  assert.equal(reportViewSourceFrom('notification'), 'notification');
  assert.equal(reportViewSourceFrom('home_card'), 'home_card');
  assert.equal(reportViewSourceFrom('report'), 'history');
  assert.equal(reportViewSourceFrom(null), 'history');
});

test('report_viewed 메타데이터는 서버 허용 키만', () => {
  assert.deepEqual(
    reportViewedMetadata({ kind: 'CLASS', source: 'live', completionId: 'c-1', viewerRole: 'TUTOR' }),
    { kind: 'CLASS', source: 'live', completion_id: 'c-1', viewer_role: 'TUTOR' },
  );
});
