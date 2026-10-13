import type { CompanionAttemptStart, CompanionReplyKind } from '@/entities/companion-chat';

/**
 * 질문 초대 "시도 장면" 상태 - 아이가 준비되지 않은 행동(창문으로 나가자 등)을 내면 그레텔 대화가 그 행동을 해 보다가 막히는
 * 장면을 만들고(TRY_FAIL), 그 장면 안에서 몇 번 더 이야기한 뒤(최대 maxTurns번) 원래 질문 지점으로 돌아온다(ATTEMPT_END).
 * 서버는 이 상태를 들고 있지 않는다(무상태) - 대화 패널이 들고 있다가 매 요청에 같이 보낸다. 이야기 진행(runtime 상태)은
 * 시도 장면 내내 그 질문 지점(awaiting-question) 그대로다.
 */
export type ActiveAttempt = {
  anchorId: string;
  /** 아이가 해 보자고 한 것(뜻). */
  tried: string;
  /** 장면 줄과 그레텔이 물은 말 - 장면 안 대화의 기준으로 서버에 다시 보낸다. */
  scene: string;
  /** 장면 안에서 아이가 이미 말한 횟수. */
  turns: number;
  maxTurns: number;
};

export type AttemptState = {
  /** 질문 지점마다 만든 시도 장면 수 - 서버 상한(질문 지점당 2회, TTS 하루 한도 보호)과 같은 수를 센다. */
  triedByAnchor: Record<string, number>;
  active: ActiveAttempt | null;
};

/** 시도 장면이 어떻게 끝났는지 - RETURN(아이·그레텔이 다른 방법을 찾자며 돌아옴), LIMIT(장면 안 말 상한), ACTION(장면 안에서 준비된 행동을 제안함), CLOSED(대화를 닫음). */
export type AttemptEndReason = 'RETURN' | 'LIMIT' | 'ACTION' | 'CLOSED';

export type AttemptEvent =
  | { kind: 'START'; anchorId: string; tried: string; sceneLineCount: number }
  | { kind: 'END'; anchorId: string; tried: string; turns: number; reason: AttemptEndReason };

export const NO_ATTEMPTS: AttemptState = { triedByAnchor: {}, active: null };

/** 이번 요청에 실을 시도 장면 상태(BE DialogueInput.Attempt). */
export function attemptRequest(state: AttemptState, anchorId: string) {
  const active = state.active && state.active.anchorId === anchorId ? state.active : null;
  return {
    tried: state.triedByAnchor[anchorId] ?? 0,
    active: active ? { tried: active.tried, scene: active.scene, turn: active.turns + 1 } : null,
  };
}

/** 지금 이 질문 지점의 시도 장면 안인지 - 장면 안 말은 대화 정리(3왕복 뒤 복귀 제안) 횟수에 세지 않는다. */
export function inAttempt(state: AttemptState, anchorId: string | null): boolean {
  return Boolean(anchorId && state.active && state.active.anchorId === anchorId);
}

/**
 * 그레텔 답 뒤 시도 장면 상태를 넘긴다. 시도 장면 안에서 답이 오면 장면 안 말 수를 하나 올리고, ATTEMPT_END·상한·준비된
 * 행동 제안·마무리면 장면을 끝낸다. 시도 장면 밖에서 TRY_FAIL이 오면 새 장면을 시작한다.
 */
export function attemptAfterReply(
  state: AttemptState,
  input: {
    anchorId: string | null;
    mode: 'CHAT' | 'INVITE';
    replyKind: CompanionReplyKind;
    proposedActionFamilyId: string | null;
    childWantsToEnd: boolean;
    attempt?: CompanionAttemptStart;
    /** 아이가 해 보자고 한 것 - 서버가 준 뜻(childMeaning), 없으면 아이 말. */
    tried: string;
    responseText: string;
  },
): { state: AttemptState; event: AttemptEvent | null } {
  const { anchorId } = input;
  if (input.mode !== 'INVITE' || !anchorId) return { state, event: null };

  const active = state.active && state.active.anchorId === anchorId ? state.active : null;
  if (active) {
    const turns = active.turns + 1;
    const reason: AttemptEndReason | null =
      input.replyKind === 'CLOSE' || input.childWantsToEnd
        ? 'CLOSED'
        : input.proposedActionFamilyId
          ? 'ACTION'
          : input.replyKind === 'ATTEMPT_END'
            ? turns >= active.maxTurns
              ? 'LIMIT'
              : 'RETURN'
            : turns >= active.maxTurns
              ? 'LIMIT'
              : null;
    if (reason) {
      return {
        state: { ...state, active: null },
        event: { kind: 'END', anchorId, tried: active.tried, turns, reason },
      };
    }
    return { state: { ...state, active: { ...active, turns } }, event: null };
  }

  if (input.replyKind === 'TRY_FAIL' && input.attempt) {
    const tried = input.tried.trim() || '이야기 속에서 해 보기';
    const scene = [...input.attempt.scene.map((line) => line.text), input.responseText].join(' / ');
    return {
      state: {
        triedByAnchor: { ...state.triedByAnchor, [anchorId]: (state.triedByAnchor[anchorId] ?? 0) + 1 },
        active: { anchorId, tried, scene, turns: 0, maxTurns: input.attempt.maxTurns },
      },
      event: { kind: 'START', anchorId, tried, sceneLineCount: input.attempt.scene.length },
    };
  }
  return { state, event: null };
}

/** 대화를 닫으면 진행 중인 시도 장면도 끝난다(원래 질문 지점은 그대로). */
export function attemptOnClose(state: AttemptState): { state: AttemptState; event: AttemptEvent | null } {
  const active = state.active;
  if (!active) return { state, event: null };
  return {
    state: { ...state, active: null },
    event: { kind: 'END', anchorId: active.anchorId, tried: active.tried, turns: active.turns, reason: 'CLOSED' },
  };
}
