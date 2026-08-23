/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { StoryRuntimeState } from '@/entities/story-runtime';

import { buildExitDiagnostics } from './exit-diagnostics';

test('종료 진단은 현재 분기와 음성 clip을 비식별 메타데이터로 만든다', () => {
  const state = {
    status: 'playing-response',
    sceneId: 'HG-F07',
    anchorId: 'HG-Q-C',
    questionRound: 1,
    plan: {
      kind: 'fallback',
      familyId: 'C_USE_SIGNAL',
    },
  } as unknown as StoryRuntimeState;

  assert.deepEqual(
    buildExitDiagnostics({
      state,
      questionOutcomes: [],
      clipId: 'c-use-signal-004',
      narration: {
        isSpeaking: true,
        isPaused: false,
        source: 'fixed',
      },
    }),
    {
      runtime_status: 'playing-response',
      audio_state: 'playing',
      audio_source: 'fixed',
      scene_id: 'HG-F07',
      anchor_id: 'HG-Q-C',
      family_id: 'C_USE_SIGNAL',
      clip_id: 'c-use-signal-004',
    },
  );
});

test('분기 합류 뒤 종료해도 마지막으로 고른 family를 남긴다', () => {
  const state = {
    status: 'playing-fixed',
    sceneId: 'HG-F08',
    audioGroupId: 'HG-F08-G01',
    clipIndex: 0,
  } as unknown as StoryRuntimeState;

  const result = buildExitDiagnostics({
    state,
    questionOutcomes: [
      {
        anchorId: 'HG-Q-C',
        childRelevantMeaning: '신호를 정한다',
        route: 'THREE_PATHS',
        responseText: '신호를 정해 보자.',
        selectedOption: {
          label: '신호 사용하기',
          meaning: '남매가 약속한 신호를 쓴다.',
          actionFamilyId: 'C_USE_SIGNAL',
        },
      },
    ] as never,
    clipId: 'HG-F08-CLIP-002',
    narration: { isSpeaking: false, isPaused: true, source: 'fixed' },
  });

  assert.equal(result.family_id, 'C_USE_SIGNAL');
  assert.equal(result.audio_state, 'paused');
  assert.equal(result.scene_id, 'HG-F08');
});
