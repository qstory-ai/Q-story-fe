import {
  narrationUtteranceSlug,
  type StoryRuntimePackage,
} from '@/entities/story';

/** 그레텔 대화 요청에 같이 보내는 지금 장면 - BE DialogueInput.Scene과 같은 모양. */
export type DialogueScene = {
  title: string;
  storySoFar: string[];
  recentLines: string[];
  visual: string;
};

export type DialogueTurnRole = 'CHILD' | 'CHARACTER';

/** 방금 들은 대사를 몇 줄까지 보낼지 - 길면 AI가 오래된 대사에 끌려간다. */
const RECENT_LINE_COUNT = 6;

/**
 * 아이가 지금까지 들은 것만으로 장면 맥락을 만든다(Q-31).
 * - storySoFar: 지난 장면들의 줄거리. 지금 장면의 줄거리에는 아직 듣지 않은 뒷부분이 들어 있어 넣지 않는다.
 * - recentLines: 지금 장면에서 lastClipId까지 들은 대사(없으면 장면 첫 대사 전까지 = 빈 목록).
 * - visual: 마지막으로 들은 대사의 그림 설명.
 */
export function buildDialogueScene(
  storyPackage: StoryRuntimePackage,
  sceneId: string,
  lastClipId: string | null,
): DialogueScene | null {
  const scenes = storyPackage.presentation.scenes;
  const sceneIndex = scenes.findIndex((candidate) => candidate.id === sceneId);
  if (sceneIndex < 0) return null;
  const scene = scenes[sceneIndex];
  const storyPrefix = `${storyPackage.storyId}-`;
  const stem = scene.id.startsWith(storyPrefix) ? scene.id.slice(storyPrefix.length) : scene.id;

  const heard: { text: string; speaker: string; visualId: string | null }[] = [];
  let reachedLastClip = lastClipId === null;
  for (const [index, segment] of scene.segments.entries()) {
    if (segment.kind !== 'utterance') continue;
    if (lastClipId === null) break;
    heard.push({ text: segment.text, speaker: segment.speaker, visualId: segment.visualId ?? null });
    if (narrationUtteranceSlug(stem, index) === lastClipId) {
      reachedLastClip = true;
      break;
    }
  }
  // 지금 장면의 대사가 아니면(다른 장면의 clip id) 들은 대사를 보내지 않는다 - 엉뚱한 맥락보다 낫다.
  const lines = reachedLastClip ? heard : [];

  const speakerName = (tag: string) => {
    const speakerId = storyPackage.speakerIdForTag(tag);
    if (speakerId === storyPackage.narratorSpeakerId) return '내레이터';
    return (
      storyPackage.manifest.speakers.find((speaker) => speaker.id === speakerId)?.displayName ?? tag
    );
  };
  const recentLines = lines
    .slice(-RECENT_LINE_COUNT)
    .map((line) => `${speakerName(line.speaker)}: ${line.text.replaceAll('\n', ' ').replace(/[“”]/g, '')}`);

  const visualId = lines.at(-1)?.visualId ?? scene.visuals[0]?.id ?? null;
  const visual = scene.visuals.find((candidate) => candidate.id === visualId);
  const visualText = visual
    ? `${visual.characters.join(', ')} / ${visual.time} / ${visual.location} / ${visual.mode}`
    : '';

  const storySoFar = scenes
    .slice(0, sceneIndex)
    .map((previous) => storyPackage.dialogue.sceneSynopses[previous.id])
    .filter((synopsis): synopsis is string => Boolean(synopsis));

  return { title: scene.title, storySoFar, recentLines, visual: visualText };
}

/** 긴 대화 정리 - 3왕복 뒤 복귀 제안, 원하면 2왕복 더, 그다음 마무리(Q-31 초기값). */
export const DIALOGUE_TURN_BUDGET = { suggestReturnAfter: 3, extraTurns: 2 } as const;

export type WrapUpSignal = 'NONE' | 'SUGGEST_RETURN' | 'CLOSE';

/**
 * 이번에 보낼 아이 말이 몇 번째 왕복인지로 정리 신호를 정한다.
 * extended: 복귀 제안 뒤 아이가 "더 이야기하기"를 골랐는지.
 */
export function wrapUpFor(childTurnNumber: number, extended: boolean): WrapUpSignal {
  const { suggestReturnAfter, extraTurns } = DIALOGUE_TURN_BUDGET;
  if (!extended) {
    return childTurnNumber >= suggestReturnAfter ? 'SUGGEST_RETURN' : 'NONE';
  }
  return childTurnNumber >= suggestReturnAfter + extraTurns ? 'CLOSE' : 'NONE';
}
