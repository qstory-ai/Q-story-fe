/**
 * 말이 끝났는지 판정하는 순수 모듈(Q-34). 마이크 소리 크기(RMS, 0..1)를 시각과 함께 한 프레임씩 넣으면
 * 'continue' 또는 'stop'을 돌려준다. 타이머·Web Audio에 기대지 않아 테스트에서 프레임만으로 검증한다.
 *
 * - 첫 calibrationMs 동안의 평균으로 주변 소음 바닥을 잡고(너무 시끄러우면 maxNoiseFloor로 묶는다),
 *   소음 바닥의 speechToNoiseRatio배(최소 minSpeechRms)를 넘는 프레임을 말소리로 본다.
 * - 말소리가 minSpeechMs 이상 이어져야(짧은 틈은 gapToleranceMs까지 같은 말로 본다) "말했다"로 친다.
 * - 말한 뒤 trailingSilenceMs 동안 말소리가 없으면 'stop'. 말을 한 번도 안 했으면 절대 'stop' 하지 않는다
 *   (소음만 있으면 녹음 상한 시간과 무응답 처리에 맡긴다).
 */
export type LevelFrame = {
  /** 녹음 시작 기준 ms(단조 증가). */
  atMs: number;
  /** 프레임의 RMS 진폭(0..1). */
  rms: number;
};

export type SilenceDecision = 'continue' | 'stop';

export type SilenceDetectorParams = {
  calibrationMs: number;
  minSpeechMs: number;
  trailingSilenceMs: number;
  gapToleranceMs: number;
  minSpeechRms: number;
  speechToNoiseRatio: number;
  maxNoiseFloor: number;
};

export const DEFAULT_SILENCE_PARAMS: SilenceDetectorParams = {
  calibrationMs: 300,
  minSpeechMs: 400,
  trailingSilenceMs: 1_500,
  gapToleranceMs: 200,
  minSpeechRms: 0.02,
  speechToNoiseRatio: 3,
  maxNoiseFloor: 0.03,
};

/** 소음 바닥이 더 조용한 프레임 쪽으로 천천히 내려가는 비율. */
const FLOOR_DECAY = 0.05;

export function createSilenceDetector(overrides: Partial<SilenceDetectorParams> = {}) {
  const params = { ...DEFAULT_SILENCE_PARAMS, ...overrides };

  let firstAt: number | null = null;
  let previousAt: number | null = null;
  let calibrationSum = 0;
  let calibrationCount = 0;
  let noiseFloor: number | null = null;
  let runStartAt: number | null = null;
  let lastSpeechAt: number | null = null;
  let heardSpeech = false;
  let stopped = false;

  function threshold(floor: number) {
    return Math.max(params.minSpeechRms, floor * params.speechToNoiseRatio);
  }

  function push(frame: LevelFrame): SilenceDecision {
    if (stopped) return 'stop';
    const { atMs, rms } = frame;
    const frameMs = previousAt === null ? 0 : Math.max(0, atMs - previousAt);
    previousAt = atMs;
    firstAt ??= atMs;

    if (noiseFloor === null) {
      if (atMs - firstAt < params.calibrationMs) {
        calibrationSum += rms;
        calibrationCount += 1;
        return 'continue';
      }
      const mean = calibrationCount > 0 ? calibrationSum / calibrationCount : 0;
      noiseFloor = Math.min(params.maxNoiseFloor, mean);
    }

    const isSpeech = rms >= threshold(noiseFloor);
    if (isSpeech) {
      if (
        runStartAt === null ||
        lastSpeechAt === null ||
        atMs - lastSpeechAt > params.gapToleranceMs + frameMs
      ) {
        runStartAt = atMs;
      }
      lastSpeechAt = atMs;
      if (!heardSpeech && atMs - runStartAt + frameMs >= params.minSpeechMs) {
        heardSpeech = true;
      }
      return 'continue';
    }

    if (rms < noiseFloor) {
      noiseFloor = noiseFloor * (1 - FLOOR_DECAY) + rms * FLOOR_DECAY;
    }
    if (
      heardSpeech &&
      lastSpeechAt !== null &&
      atMs - lastSpeechAt >= params.trailingSilenceMs
    ) {
      stopped = true;
      return 'stop';
    }
    return 'continue';
  }

  return {
    push,
    /** minSpeechMs 이상 말소리가 한 번이라도 있었는지. */
    heardSpeech: () => heardSpeech,
  };
}

export type SilenceDetector = ReturnType<typeof createSilenceDetector>;
