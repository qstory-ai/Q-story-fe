import type { QuestionOutcome } from '@/entities/report';
import type { PlayTurn } from '@/entities/play-session';
import type { StoryRuntimePackage } from '@/entities/story';

/**
 * Q-39 리포트의 순수 계산 - 저장된 대화 줄(PlayTurn)을 그대로 묶어 화면에 내보낸다. 아이 말·그레텔 답은
 * 원문을 그대로 쓰고, AI가 다시 쓰지 않는다.
 */

export type SceneExchange = {
  sceneId: string;
  sceneTitle: string;
  visualId: string | null;
  /** 대표 대화 - 아이가 처음 말하기 직전 그레텔 말, 아이 말, 바로 뒤 그레텔 답. */
  lead: PlayTurn[];
  /** 앞뒤 나머지 줄(펼쳐 보기). */
  rest: PlayTurn[];
};

export type StoryChange = {
  sceneId: string | null;
  familyId: string;
  meaning: string;
  summary: string | null;
  resultVisualId: string | null;
  viaSuggestion: boolean;
  suggestionLabel: string | null;
};

const isChildLine = (turn: PlayTurn) => turn.role === 'CHILD' && Boolean(turn.text?.trim());
const isSpoken = (turn: PlayTurn) => turn.role !== 'SYSTEM';

export function sceneTitleOf(storyPackage: StoryRuntimePackage, sceneId: string | null | undefined) {
  if (!sceneId) return '';
  return storyPackage.presentation.scenes.find((scene) => scene.id === sceneId)?.title ?? '';
}

export function sceneNumberOf(storyPackage: StoryRuntimePackage, sceneId: string | null | undefined) {
  const index = storyPackage.presentation.scenes.findIndex((scene) => scene.id === sceneId);
  return index < 0 ? null : index + 1;
}

/** 장면별로 묶고, 아이가 말한 장면만 남긴다. 장면 순서는 대화가 처음 나온 순서. */
export function groupExchanges(storyPackage: StoryRuntimePackage, turns: readonly PlayTurn[]): SceneExchange[] {
  const ordered = [...turns].sort((a, b) => a.seq - b.seq);
  const groups = new Map<string, PlayTurn[]>();
  for (const turn of ordered) {
    const list = groups.get(turn.sceneId) ?? [];
    list.push(turn);
    groups.set(turn.sceneId, list);
  }
  const exchanges: SceneExchange[] = [];
  for (const [sceneId, list] of groups) {
    const childIndex = list.findIndex(isChildLine);
    if (childIndex < 0) continue;
    const before = list.slice(0, childIndex).filter(isSpoken).at(-1);
    const after = list.slice(childIndex + 1).find((turn) => turn.role === 'CHARACTER');
    const lead = [before, list[childIndex], after].filter((turn): turn is PlayTurn => Boolean(turn));
    const leadSeqs = new Set(lead.map((turn) => turn.seq));
    exchanges.push({
      sceneId,
      sceneTitle: sceneTitleOf(storyPackage, sceneId),
      visualId: list[childIndex].visualId ?? lead.find((turn) => turn.visualId)?.visualId ?? null,
      lead,
      rest: list.filter((turn) => !leadSeqs.has(turn.seq)),
    });
  }
  return exchanges;
}

/** 장면 대화 전부(seq 순) - 크게 보기 화면이 lead와 rest를 다시 합쳐 원래 순서대로 보여 준다. */
export function sceneDialogue(exchange: SceneExchange): PlayTurn[] {
  return [...exchange.lead, ...exchange.rest].sort((a, b) => a.seq - b.seq);
}

export type ChildReplyPair = { child: PlayTurn; reply: PlayTurn | null };

/**
 * 장면 카드에 보여 줄 아이 말과 그 말에 대한 그레텔의 바로 다음 답. 다음 아이 말이 오기 전의
 * 첫 캐릭터 줄만 답으로 본다(아이가 연달아 말했으면 앞 말은 답 없이).
 */
export function childReplyPairs(exchange: SceneExchange): ChildReplyPair[] {
  const ordered = sceneDialogue(exchange);
  const pairs: ChildReplyPair[] = [];
  ordered.forEach((turn, index) => {
    if (!isChildLine(turn)) return;
    let reply: PlayTurn | null = null;
    for (const next of ordered.slice(index + 1)) {
      if (isChildLine(next)) break;
      if (next.role === 'CHARACTER' && next.text?.trim()) {
        reply = next;
        break;
      }
    }
    pairs.push({ child: turn, reply });
  });
  return pairs;
}

/**
 * 실제로 실행된 행동. 대화 기록이 있으면 행동 확인 줄에서, 없으면(옛 기록) 저장된 질문 기록에서 찾는다.
 * 같은 행동이 두 번 나오면(되감기 등) 마지막 것만.
 */
export function storyChanges(
  storyPackage: StoryRuntimePackage,
  turns: readonly PlayTurn[] | null | undefined,
  outcomes: readonly QuestionOutcome[],
): StoryChange[] {
  const familyMeaning = (familyId: string) =>
    storyPackage.manifest.fallbackFamilies.find((family) => family.id === familyId)?.meaning ?? familyId;
  const byFamily = new Map<string, StoryChange>();
  const events = (turns ?? []).filter((turn) => turn.event === 'ACTION_CONFIRMED' && turn.familyId);
  if (events.length > 0) {
    for (const turn of [...events].sort((a, b) => a.seq - b.seq)) {
      const familyId = turn.familyId as string;
      byFamily.set(familyId, {
        sceneId: turn.sceneId,
        familyId,
        meaning: familyMeaning(familyId),
        summary: storyPackage.branchReportSummary(familyId),
        resultVisualId: turn.resultVisualId ?? storyPackage.branchIllustrationAssetId(familyId),
        viaSuggestion: Boolean(turn.viaSuggestion),
        suggestionLabel: turn.suggestionLabel ?? null,
      });
    }
    return [...byFamily.values()];
  }
  for (const outcome of outcomes) {
    const familyId = outcome.selectedOption?.actionFamilyId ?? outcome.actionFamilyId;
    if (!familyId) continue;
    const anchor = storyPackage.manifest.questionAnchors.find((candidate) => candidate.id === outcome.anchorId);
    byFamily.set(familyId, {
      sceneId: anchor?.sceneId ?? null,
      familyId,
      meaning: familyMeaning(familyId),
      summary: storyPackage.branchReportSummary(familyId),
      resultVisualId: storyPackage.branchIllustrationAssetId(familyId),
      viaSuggestion: Boolean(outcome.viaSuggestion),
      suggestionLabel: outcome.suggestionLabel ?? null,
    });
  }
  return [...byFamily.values()];
}

/** 아이 말 옆에 붙는 표시 - 원문이 어떻게 들어왔는지. */
export function inputTags(turn: PlayTurn): string[] {
  if (turn.role !== 'CHILD') return [];
  const tags: string[] = [];
  if (turn.speaker === 'TEACHER_RELAY') tags.push('선생님이 입력');
  if (turn.speaker === 'GUARDIAN_PROXY') tags.push('보호자가 대신 입력');
  if (turn.inputMode === 'VOICE') tags.push('음성 인식 문장');
  if (turn.inputMode === 'TEXT') tags.push('글로 입력');
  if (turn.transcriptEdited) tags.push('고쳐 씀');
  return tags;
}

/** "1~10화 끝까지 읽음" / "1~6화까지 읽고 멈춤". */
export function readRangeLabel(
  storyPackage: StoryRuntimePackage,
  fromSceneId: string | null | undefined,
  throughSceneId: string | null | undefined,
  endStatus: 'COMPLETED' | 'EXITED' | null | undefined,
) {
  const from = sceneNumberOf(storyPackage, fromSceneId) ?? 1;
  const through = sceneNumberOf(storyPackage, throughSceneId);
  const total = storyPackage.presentation.scenes.length;
  if (endStatus === 'EXITED') {
    return through ? `${from}~${through}화까지 읽고 멈춤` : '읽다가 멈춤';
  }
  return `${from}~${through ?? total}화 끝까지 읽음`;
}

/** 시도 장면에서 내레이터가 읽은 줄 - 대사가 아니라 이야기 서술이다. */
export function isNarrationTurn(turn: PlayTurn) {
  return turn.role === 'CHARACTER' && turn.replyKind === 'ATTEMPT_SCENE' && Boolean(turn.characterSpeakerId?.endsWith('NARRATOR'));
}

/** 수업 기록 표의 대화 한 줄 - 아이 말, 그레텔 말, 시도 장면 서술. */
export type ClassLine = {
  seq: number;
  who: 'CHILD' | 'CHARACTER' | 'NARRATION';
  text: string;
};

export type ClassSceneRow = {
  sceneId: string;
  sceneTitle: string;
  /** 주고받은 말을 기록 순서(seq)대로 - 아이 말 뒤에 그 말에 대한 그레텔 답·장면 줄이 이어진다. */
  lines: ClassLine[];
  /** 그 장면에서 이야기가 어떻게 이어졌는지 - 보호자·선생님이 읽을 문장. */
  result: string;
};

/** 대화 뒤 이야기가 어떻게 이어졌는지 - 아무 기록이 없으면 원래 이야기로 이어진 것. */
export const CLASS_RESULT_DEFAULT = '원래 이야기로 이어졌어요';

/**
 * 선생님용 수업 기록 표 - 장면마다 주고받은 말(순서대로)과 이어진 이야기. 준비된 말(질문 초대 등)은 빼고
 * 아이 말과 그 자리에서 만든 그레텔 답·시도 장면 줄만 남긴다.
 */
export function classSceneRows(storyPackage: StoryRuntimePackage, turns: readonly PlayTurn[]): ClassSceneRow[] {
  const rows = new Map<string, ClassSceneRow>();
  // 결과 문장이 정해진 장면 - 없으면 기본 문장(원래 이야기로)이 남는다.
  const decided = new Set<string>();
  for (const turn of [...turns].sort((a, b) => a.seq - b.seq)) {
    const row = rows.get(turn.sceneId) ?? {
      sceneId: turn.sceneId,
      sceneTitle: sceneTitleOf(storyPackage, turn.sceneId),
      lines: [],
      result: CLASS_RESULT_DEFAULT,
    };
    const text = turn.text?.trim();
    if (turn.role === 'CHILD' && text) row.lines.push({ seq: turn.seq, who: 'CHILD', text });
    if (turn.role === 'CHARACTER' && !turn.fixed && text) {
      row.lines.push({ seq: turn.seq, who: isNarrationTurn(turn) ? 'NARRATION' : 'CHARACTER', text });
    }
    // 행동 확인은 앞선 기록을 덮고, 나머지는 그 장면의 첫 기록만 쓴다.
    if (turn.event === 'ACTION_CONFIRMED' && turn.familyId) {
      const meaning =
        storyPackage.manifest.fallbackFamilies.find((family) => family.id === turn.familyId)?.meaning ?? turn.familyId;
      row.result = `선택한 행동: ${meaning}${turn.viaSuggestion ? ' (예시를 보고 골랐어요)' : ''}`;
      decided.add(turn.sceneId);
    } else if (!decided.has(turn.sceneId)) {
      const label = classResultLabel(turn);
      if (label) {
        row.result = label;
        decided.add(turn.sceneId);
      }
    }
    rows.set(turn.sceneId, row);
  }
  return [...rows.values()].filter((row) => row.lines.length > 0 || decided.has(row.sceneId));
}

function classResultLabel(turn: PlayTurn) {
  if (turn.event === 'INVITE_SKIPPED') return '질문을 건너뛰고 원래 이야기로 이어졌어요';
  if (turn.event === 'TRY_FAILED') {
    const tried = turn.text?.trim();
    return `${tried ? `해 본 것: ${tried} - ` : '해 봤지만 '}잘 안 돼서 다른 방법을 찾아보기로 했어요`;
  }
  if (turn.event === 'INVITE_CLOSED') return '대화만 나누고 원래 이야기로 이어졌어요';
  return '';
}

/** 질문 초대를 건너뛴 장면 - 선생님에게 "다음 수업에서 이어 볼 것"으로 보여 준다. */
export function skippedInviteScenes(storyPackage: StoryRuntimePackage, turns: readonly PlayTurn[]): string[] {
  return [...new Set(turns.filter((turn) => turn.event === 'INVITE_SKIPPED').map((turn) => turn.sceneId))].map(
    (sceneId) => `${sceneNumberOf(storyPackage, sceneId) ?? ''}화 ${sceneTitleOf(storyPackage, sceneId)}`.trim(),
  );
}

export function evidenceTurns(turns: readonly PlayTurn[], seqs: readonly number[]): PlayTurn[] {
  const wanted = new Set(seqs);
  return turns.filter((turn) => wanted.has(turn.seq) && turn.role === 'CHILD' && turn.text);
}

export function hasChildLines(turns: readonly PlayTurn[] | null | undefined) {
  return (turns ?? []).some(isChildLine);
}

export type ReadAgainChoice =
  | { kind: 'none' }
  | { kind: 'one'; childId: string }
  | { kind: 'pick'; children: { id: string; name: string }[] };

/** "아이랑 다시 읽기"가 어느 아이로 열지 - 이어진 아이가 하나면 바로, 여럿이면 고르게. */
export function readAgainChoice(linkedChildren: readonly { id: string; name: string }[] | null | undefined): ReadAgainChoice {
  if (!linkedChildren || linkedChildren.length === 0) return { kind: 'none' };
  if (linkedChildren.length === 1) return { kind: 'one', childId: linkedChildren[0].id };
  return { kind: 'pick', children: [...linkedChildren] };
}
