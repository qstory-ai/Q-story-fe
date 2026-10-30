/**
 * Soft end-of-turn detector, NOT an audio trimmer or recognizer.
 * Keeps the existing recorder/PCM buffer intact. Numeric defaults need real-device validation.
 */
export type ChildFrame = { atMs: number; rms: number };
export type ChildParams = {
  calibrationMs: number; minSpeechMs: number; trailingSilenceMs: number;
  gapToleranceMs: number; minSpeechRms: number; speechToNoiseRatio: number; maxNoiseFloor: number;
};
export const CHILD_SILENCE_DEFAULTS: ChildParams = {
  calibrationMs: 200, minSpeechMs: 80, trailingSilenceMs: 2_200,
  gapToleranceMs: 250, minSpeechRms: 0.006, speechToNoiseRatio: 2.0, maxNoiseFloor: 0.03,
};
export function createChildSilenceDetector(overrides: Partial<ChildParams> = {}) {
  const p = { ...CHILD_SILENCE_DEFAULTS, ...overrides };
  for (const [name, value] of Object.entries(p)) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid silence parameter: ${name}`);
  }
  let lastAt: number | null = null;
  let startAt: number | null = null;
  let runStart: number | null = null;
  let lastSpeech: number | null = null;
  let heard = false, stopped = false;
  let floor = 0.001;
  const window: number[] = [];
  return {
    push({ atMs, rms }: ChildFrame): 'continue' | 'stop' {
      if (stopped) return 'stop';
      if (!Number.isFinite(atMs) || !Number.isFinite(rms) || rms < 0 || rms > 1
          || (lastAt !== null && atMs < lastAt)) return 'continue';
      const dt = lastAt === null ? 0 : Math.min(100, atMs - lastAt);
      lastAt = atMs;
      startAt ??= atMs;
      // Evaluate before adapting the floor, so an immediate short utterance is not discarded
      // as "calibration noise". Continuous background noise may still need manual stop.
      const threshold = Math.max(p.minSpeechRms, floor * p.speechToNoiseRatio);
      if (rms >= threshold) {
        if (runStart === null || lastSpeech === null
            || atMs - lastSpeech > p.gapToleranceMs + dt) runStart = atMs;
        lastSpeech = atMs;
        if (atMs - runStart + dt >= p.minSpeechMs) heard = true;
      } else if (heard && lastSpeech !== null && atMs - lastSpeech >= p.trailingSilenceMs) {
        stopped = true;
        return 'stop';
      }
      window.push(rms);
      if (window.length > 30) window.shift();
      if (atMs - startAt >= p.calibrationMs && window.length >= 5) {
        const sorted = [...window].sort((a, b) => a - b);
        const candidate = Math.min(p.maxNoiseFloor, sorted[Math.floor(sorted.length * 0.2)]);
        // Track quieter intervals quickly; raise the floor very slowly once speech is heard.
        const alpha = candidate < floor ? 0.15 : (heard ? 0.01 : 0.08);
        floor += alpha * (candidate - floor);
      }
      return 'continue';
    },
    heardSpeech: () => heard,
  };
}
