import { options } from './config';

export type LearningState = {
  ageBand: 'UNKNOWN' | '5-6' | '7-9';
  difficulty: number;
  hintLevel: number;
  successStreak: number;
  turnIndex: number;
  lastQuestionType: string;
  peerPhase: string;
};
type Context = {
  storyId: string; sceneId: string; conversationId: string;
  childId?: string; tutorStudentId?: string; anchorId?: string | null;
};
const sessions = new Map<string, LearningState>();
const ageBands = new Set(['UNKNOWN', '5-6', '7-9']);
const types = new Set(['NONE', 'COMPLETION', 'RECALL', 'OPEN_ENDED', 'WH', 'DISTANCING']);
const phases = new Set(['PROMPT', 'EXPAND', 'REPEAT', 'SUPPORT', 'PAUSE']);
const MAX_SESSIONS = 64;
const keyOf = (i: Context) => JSON.stringify([
  i.conversationId, i.childId ?? i.tutorStudentId ?? '',
  i.storyId, i.sceneId, i.anchorId ?? '',
]);

export function initial(age: string = 'UNKNOWN'): LearningState {
  const ageBand = (ageBands.has(age) ? age : 'UNKNOWN') as LearningState['ageBand'];
  return { ageBand, difficulty: ageBand === '7-9' ? 2 : 1, hintLevel: 0,
    successStreak: 0, turnIndex: 0, lastQuestionType: 'NONE', peerPhase: 'PROMPT' };
}
export function parseLearning(value: unknown): LearningState | undefined {
  if (!value || typeof value !== 'object') return;
  const v = value as Record<string, unknown>;
  if (typeof v.ageBand !== 'string' || !ageBands.has(v.ageBand)
      || typeof v.lastQuestionType !== 'string' || !types.has(v.lastQuestionType)
      || typeof v.peerPhase !== 'string' || !phases.has(v.peerPhase)) return;
  for (const [key, lo, hi] of [
    ['difficulty', 1, 3], ['hintLevel', 0, 3], ['successStreak', 0, 2], ['turnIndex', 0, 1000],
  ] as const) {
    const n = v[key];
    if (typeof n !== 'number' || !Number.isInteger(n) || n < lo || n > hi) return;
  }
  return {
    ageBand: v.ageBand as LearningState['ageBand'], difficulty: v.difficulty as number,
    hintLevel: v.hintLevel as number, successStreak: v.successStreak as number,
    turnIndex: v.turnIndex as number, lastQuestionType: v.lastQuestionType, peerPhase: v.peerPhase,
  };
}
export function learningRequest(input: Context): { learning?: LearningState } {
  if (!options().storyPal) return {};
  const key = keyOf(input);
  let state = sessions.get(key);
  if (!state) {
    state = initial(options().ageBand);
    if (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value!);
    sessions.set(key, state);
  }
  return { learning: { ...state } };
}
export function rememberLearning(input: Context, value: unknown) {
  if (!options().storyPal) return;
  const next = parseLearning(value);
  const key = keyOf(input);
  const previous = sessions.get(key);
  // Ignore stale/duplicate replies. No state update occurs on a failed STT/LLM request.
  if (!next || !previous || previous.turnIndex >= 1000 || next.turnIndex !== previous.turnIndex + 1) return;
  sessions.set(key, next);
}
export function setLearningAge(input: Context, age: 'UNKNOWN' | '5-6' | '7-9') {
  // Host app can call this from an existing child-profile selector. No inferred age.
  const key = keyOf(input);
  const old = sessions.get(key);
  if (sessions.size >= MAX_SESSIONS && !old) sessions.delete(sessions.keys().next().value!);
  sessions.set(key, old ? { ...old, ageBand: age } : initial(age));
}
export function clearLearningSessions() { sessions.clear(); }
