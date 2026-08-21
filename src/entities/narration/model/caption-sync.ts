const TARGET_MIN_LENGTH = 10;
const TARGET_MAX_LENGTH = 28;
const HARD_MAX_LENGTH = 36;
const ORPHAN_MIN_LENGTH = 8;
const ORPHAN_MIN_WORDS = 3;

export type CaptionCue = {
  id: string;
  text: string;
  startRatio: number;
  endRatio: number;
};

export type CaptionTrack = {
  transcript: string;
  cues: CaptionCue[];
};

function normalize(text: string) {
  return text.replace(/\s*\n+\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

function wordCount(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

function isOrphan(text: string) {
  return (
    text.replace(/\s/g, '').length < ORPHAN_MIN_LENGTH ||
    wordCount(text) < ORPHAN_MIN_WORDS
  );
}

function isNaturalBoundary(word: string) {
  return /(?:지만|는데|으며|면서|해서|하자|했고|했지만|했어요|지요|거든요|까요|고[,，]?|며[,，]?|자[,，]?|더니[,，]?)$/.test(
    word,
  );
}

function splitSentences(text: string) {
  return (
    text.match(/[^.!?。！？…]+(?:[.!?。！？…]+[”’"']?|$)/g) ?? [text]
  )
    .map((part) => part.trim())
    .filter(Boolean);
}

function splitLongUnit(unit: string) {
  if (unit.length <= HARD_MAX_LENGTH) {
    return [unit];
  }

  const punctuationClauses =
    unit.match(/[^,，;；:：]+(?:[,，;；:：]+|$)/g)?.map((part) => part.trim()) ??
    [unit];
  if (
    punctuationClauses.length > 1 &&
    punctuationClauses.every(Boolean)
  ) {
    const packed: string[] = [];
    let current = '';
    for (const clause of punctuationClauses) {
      const candidate = current ? `${current} ${clause}` : clause;
      if (current && candidate.length > TARGET_MAX_LENGTH) {
        packed.push(current);
        current = clause;
      } else {
        current = candidate;
      }
    }
    if (current) {
      packed.push(current);
    }
    return packed.flatMap((part) =>
      part.length > HARD_MAX_LENGTH ? splitByWords(part) : [part],
    );
  }

  return splitByWords(unit);
}

function splitByWords(unit: string) {
  const words = unit.split(/\s+/).filter(Boolean);
  const cues: string[] = [];
  let current: string[] = [];

  for (const word of words) {
    const candidate = [...current, word].join(' ');
    const mayClose =
      candidate.length >= TARGET_MIN_LENGTH && isNaturalBoundary(word);
    if (current.length > 0 && candidate.length > HARD_MAX_LENGTH) {
      cues.push(current.join(' '));
      current = [word];
      continue;
    }
    current.push(word);
    if (mayClose && candidate.length <= TARGET_MAX_LENGTH) {
      cues.push(current.join(' '));
      current = [];
    }
  }
  if (current.length > 0) {
    cues.push(current.join(' '));
  }
  return cues;
}

function rebalanceOrphans(input: string[]) {
  const cues = [...input];
  for (let index = cues.length - 1; index > 0; index -= 1) {
    if (!isOrphan(cues[index])) {
      continue;
    }

    const previous = cues[index - 1];
    const combined = `${previous} ${cues[index]}`;
    if (combined.length <= HARD_MAX_LENGTH + 6) {
      cues.splice(index - 1, 2, combined);
      continue;
    }

    const previousWords = previous.split(/\s+/);
    const currentWords = cues[index].split(/\s+/);
    while (
      isOrphan(currentWords.join(' ')) &&
      previousWords.length > ORPHAN_MIN_WORDS
    ) {
      currentWords.unshift(previousWords.pop()!);
    }
    cues[index - 1] = previousWords.join(' ');
    cues[index] = currentWords.join(' ');
  }
  return cues.filter(Boolean);
}

function cueWeight(text: string) {
  const spokenCharacters = text.replace(/[^\p{L}\p{N}]/gu, '').length;
  const commaPauses = (text.match(/[,，;；:：]/g) ?? []).length * 2;
  const endingPauses = (text.match(/[.!?。！？]/g) ?? []).length * 4;
  const ellipsisPauses = (text.match(/…/g) ?? []).length * 5;
  return Math.max(4, spokenCharacters + commaPauses + endingPauses + ellipsisPauses);
}

export function buildCaptionTrack(text: string): CaptionTrack {
  const transcript = normalize(text);
  if (!transcript) {
    return { transcript: '', cues: [] };
  }

  const cueTexts = rebalanceOrphans(
    splitSentences(transcript).flatMap(splitLongUnit),
  );
  const weights = cueTexts.map(cueWeight);
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  let elapsedWeight = 0;
  const cues = cueTexts.map((cueText, index): CaptionCue => {
    const startRatio = elapsedWeight / totalWeight;
    elapsedWeight += weights[index];
    return {
      id: `caption-${index + 1}`,
      text: cueText,
      startRatio,
      endRatio: index === cueTexts.length - 1 ? 1 : elapsedWeight / totalWeight,
    };
  });
  return { transcript, cues };
}

export function buildCaptionCues(text: string) {
  return buildCaptionTrack(text).cues.map((cue) => cue.text);
}

export function estimateNarrationDurationSeconds(text: string) {
  const track = buildCaptionTrack(text);
  const totalWeight = track.cues.reduce(
    (total, cue) => total + cueWeight(cue.text),
    0,
  );
  return Math.max(1.5, totalWeight / 7);
}

export function captionCueAtProgress(
  trackOrCues: CaptionTrack | string[],
  progress: number,
) {
  const cues = Array.isArray(trackOrCues)
    ? trackOrCues.map((text, index) => ({
        id: `legacy-${index}`,
        text,
        startRatio: index / Math.max(1, trackOrCues.length),
        endRatio: (index + 1) / Math.max(1, trackOrCues.length),
      }))
    : trackOrCues.cues;
  if (cues.length === 0) {
    return '';
  }
  const normalized = Number.isFinite(progress)
    ? Math.max(0, Math.min(1, progress))
    : 0;
  return (
    cues.find(
      (cue, index) =>
        normalized >= cue.startRatio &&
        (normalized < cue.endRatio || index === cues.length - 1),
    ) ?? cues.at(-1)!
  ).text;
}
