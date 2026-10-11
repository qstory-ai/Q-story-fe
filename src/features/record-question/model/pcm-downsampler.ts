/**
 * 마이크 샘플(AudioContext 속도, 보통 48kHz/44.1kHz, -1..1 float)을 실시간 받아 적기용 16kHz 16bit PCM 조각으로
 * 바꾼다. 출력 칸마다 그 칸에 들어가는 입력 샘플의 평균을 낸다(간단한 저역 통과 - 접힘 잡음을 줄인다).
 * public/audio/pcm-capture-worklet.js에 같은 계산이 있다(워클릿은 따로 불러오는 파일이라 이 모듈을 쓸 수 없다).
 */
export const STREAM_SAMPLE_RATE = 16_000;
/** 한 조각 = 100ms(1,600 샘플, 3.2KB) - 서버로 보내는 단위. */
export const STREAM_FRAME_SAMPLES = 1_600;

export function createPcmDownsampler(inputSampleRate: number, onFrame: (frame: Int16Array) => void) {
  const ratio = inputSampleRate / STREAM_SAMPLE_RATE;
  let frame = new Int16Array(STREAM_FRAME_SAMPLES);
  let frameLength = 0;
  // 지금 채우는 출력 칸의 누적값과 개수, 그리고 다음 칸이 시작되는 입력 위치(소수).
  let sum = 0;
  let count = 0;
  let nextBoundary = ratio;
  let position = 0;

  const emit = (value: number) => {
    const clamped = Math.max(-1, Math.min(1, value));
    frame[frameLength] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    frameLength += 1;
    if (frameLength === STREAM_FRAME_SAMPLES) {
      onFrame(frame);
      frame = new Int16Array(STREAM_FRAME_SAMPLES);
      frameLength = 0;
    }
  };

  return {
    push(samples: Float32Array) {
      for (let i = 0; i < samples.length; i += 1) {
        sum += samples[i];
        count += 1;
        position += 1;
        if (position >= nextBoundary) {
          emit(sum / count);
          sum = 0;
          count = 0;
          nextBoundary += ratio;
        }
      }
    },
    /** 남은 샘플을 마지막 (짧은) 조각으로 내보낸다. */
    flush() {
      if (count > 0) {
        emit(sum / count);
        sum = 0;
        count = 0;
      }
      if (frameLength > 0) {
        onFrame(frame.slice(0, frameLength));
        frame = new Int16Array(STREAM_FRAME_SAMPLES);
        frameLength = 0;
      }
    },
  };
}
