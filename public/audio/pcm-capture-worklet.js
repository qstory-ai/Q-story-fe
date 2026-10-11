/**
 * 실시간 받아 적기용 마이크 캡처 워클릿 - AudioContext 속도의 float 샘플을 16kHz 16bit PCM 100ms 조각으로 바꿔
 * 메인 스레드로 보낸다(port.postMessage, ArrayBuffer 이전). 계산은 src/features/record-question/model/pcm-downsampler.ts와
 * 같다 - 워클릿은 따로 불러오는 파일이라(CSP script-src 'self') 번들 모듈을 쓰지 못해 여기 다시 적는다.
 * 메인 스레드가 {type:'flush'}를 보내면 남은 샘플을 마지막 조각으로 보내고 {type:'flushed'}로 답한다.
 */
const TARGET_RATE = 16000;
const FRAME_SAMPLES = 1600;

class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / TARGET_RATE;
    this.frame = new Int16Array(FRAME_SAMPLES);
    this.frameLength = 0;
    this.sum = 0;
    this.count = 0;
    this.nextBoundary = this.ratio;
    this.position = 0;
    this.stopped = false;
    this.port.onmessage = (event) => {
      if (event.data && event.data.type === 'flush') {
        if (this.count > 0) {
          this.emit(this.sum / this.count);
          this.sum = 0;
          this.count = 0;
        }
        if (this.frameLength > 0) {
          const last = this.frame.slice(0, this.frameLength);
          this.port.postMessage(last.buffer, [last.buffer]);
          this.frame = new Int16Array(FRAME_SAMPLES);
          this.frameLength = 0;
        }
        this.port.postMessage({ type: 'flushed' });
        this.stopped = true;
      }
    };
  }

  emit(value) {
    const clamped = Math.max(-1, Math.min(1, value));
    this.frame[this.frameLength] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    this.frameLength += 1;
    if (this.frameLength === FRAME_SAMPLES) {
      const full = this.frame;
      this.port.postMessage(full.buffer, [full.buffer]);
      this.frame = new Int16Array(FRAME_SAMPLES);
      this.frameLength = 0;
    }
  }

  process(inputs) {
    if (this.stopped) return false;
    const channel = inputs[0] && inputs[0][0];
    if (channel) {
      for (let i = 0; i < channel.length; i += 1) {
        this.sum += channel[i];
        this.count += 1;
        this.position += 1;
        if (this.position >= this.nextBoundary) {
          this.emit(this.sum / this.count);
          this.sum = 0;
          this.count = 0;
          this.nextBoundary += this.ratio;
        }
      }
    }
    return true;
  }
}

registerProcessor('qstory-pcm-capture', PcmCaptureProcessor);
