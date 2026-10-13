import type { CompanionReplyKind } from '@/entities/companion-chat';

import type { WrapUpSignal } from './dialogue-context';

/** 그레텔 답 뒤 대화 패널이 갈 다음 단계(use-dialogue의 DialoguePhase 중 답 뒤에 올 수 있는 것). */
export type NextDialoguePhase = 'ready' | 'proposal' | 'offer-help' | 'suggest-return';

export type NextDialogueStep = {
  /** 답을 들려준 뒤 대화를 닫는다(마무리 인사·아이가 끝내고 싶음·대화 상한). */
  ending: boolean;
  phase: NextDialoguePhase;
  /**
   * "실패해 보기" 장면이었다 - 행동 확인·도움 제안·복귀 제안 없이 같은 질문 지점(아이 차례)으로 돌아온다. 이야기 진행
   * (runtime 상태)은 건드리지 않는다.
   */
  triedAndFailed: boolean;
};

/**
 * 그레텔 답 신호로 다음 단계를 정한다. 실패해 보기(TRY_FAIL)는 질문 초대에서만 의미가 있다 - 상시 대화에서 오면 보통 답으로 본다.
 * 실패 장면은 그레텔이 "다른 방법을 찾아보자"며 아이 생각을 물은 직후라, 복귀 제안(suggest-return)으로 말을 끊지 않고
 * 아이 차례(ready)로 둔다. 대화 상한(wrapUp CLOSE)만은 그대로 지킨다.
 */
export function nextDialogueStep(input: {
  replyKind: CompanionReplyKind;
  childWantsToEnd: boolean;
  asksForHelp: boolean;
  proposedActionFamilyId: string | null;
  mode: 'CHAT' | 'INVITE';
  wrapUp: WrapUpSignal;
  /** 남은 도움 단계가 있는지. */
  helpAvailable: boolean;
}): NextDialogueStep {
  const triedAndFailed = input.replyKind === 'TRY_FAIL' && input.mode === 'INVITE';
  if (triedAndFailed) {
    return { ending: input.wrapUp === 'CLOSE', phase: 'ready', triedAndFailed };
  }
  const ending = input.replyKind === 'CLOSE' || input.childWantsToEnd || input.wrapUp === 'CLOSE';
  const phase: NextDialoguePhase = ending
    ? 'ready'
    : input.proposedActionFamilyId && input.mode === 'INVITE'
      ? 'proposal'
      : input.asksForHelp && input.helpAvailable
        ? 'offer-help'
        : input.wrapUp === 'SUGGEST_RETURN'
          ? 'suggest-return'
          : 'ready';
  return { ending, phase, triedAndFailed: false };
}
