import { createPcmDownsampler } from './pcm-downsampler';

/** public/audio/pcm-capture-worklet.js - 같은 출처 파일이라 CSP(script-src 'self')를 지킨다. */
const WORKLET_URL = '/audio/pcm-capture-worklet.js';
const WORKLET_NAME = 'qstory-pcm-capture';
const SCRIPT_PROCESSOR_BUFFER = 4096;
const FLUSH_WAIT_MS = 150;

export type PcmCapture = {
  /** 남은 샘플을 내보내고 노드를 뗀다. 여러 번 불러도 된다. */
  stop: () => Promise<void>;
};

const workletReady = new WeakMap<BaseAudioContext, Promise<boolean>>();

function loadWorklet(context: AudioContext): Promise<boolean> {
  let ready = workletReady.get(context);
  if (!ready) {
    ready = context.audioWorklet
      ? context.audioWorklet.addModule(WORKLET_URL).then(
          () => true,
          () => false,
        )
      : Promise.resolve(false);
    workletReady.set(context, ready);
  }
  return ready;
}

/** 탭 핸들러에서 미리 워클릿 파일을 받아 둔다 - 녹음 시작 직후 첫 소리를 놓치지 않게. 실패해도 조용히 넘어간다. */
export function preloadPcmCapture(context: AudioContext) {
  void loadWorklet(context);
}

/**
 * 녹음 중인 마이크(source)에서 16kHz PCM 100ms 조각을 받아 onFrame으로 넘긴다(실시간 받아 적기).
 * AudioWorklet(Chrome·Android WebView, iOS 14.5+ Safari/WKWebView)을 쓰고, 없거나 불러오지 못하면 ScriptProcessor로
 * 대신한다. 소리를 스피커로 내보내지 않게 0 볼륨 노드로만 끝을 잇는다(어떤 브라우저는 끝이 이어져야 처리한다).
 * AudioContext가 멈춰 있으면(탭 밖 자동 시작 등) 샘플이 오지 않는다 - 그때는 null을 돌려 호출부가 배치로 간다.
 */
export async function startPcmCapture(
  context: AudioContext,
  source: MediaStreamAudioSourceNode,
  onFrame: (frame: Int16Array) => void,
): Promise<PcmCapture | null> {
  if (context.state !== 'running') return null;
  const sink = context.createGain();
  sink.gain.value = 0;
  sink.connect(context.destination);

  if (await loadWorklet(context)) {
    try {
      const node = new AudioWorkletNode(context, WORKLET_NAME, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
        channelCountMode: 'explicit',
      });
      let flushed: (() => void) | null = null;
      node.port.onmessage = (event: MessageEvent<ArrayBuffer | { type: string }>) => {
        if (event.data instanceof ArrayBuffer) {
          onFrame(new Int16Array(event.data));
        } else if (event.data?.type === 'flushed') {
          flushed?.();
        }
      };
      source.connect(node);
      node.connect(sink);
      let stopping: Promise<void> | null = null;
      return {
        stop: () => {
          stopping ??= new Promise<void>((resolve) => {
            flushed = resolve;
            node.port.postMessage({ type: 'flush' });
            setTimeout(resolve, FLUSH_WAIT_MS);
          }).then(() => {
            disconnect(source, node, sink);
            node.port.onmessage = null;
          });
          return stopping;
        },
      };
    } catch {
      // 아래 ScriptProcessor로 간다.
    }
  }

  if (typeof context.createScriptProcessor !== 'function') {
    sink.disconnect();
    return null;
  }
  const processor = context.createScriptProcessor(SCRIPT_PROCESSOR_BUFFER, 1, 1);
  const downsampler = createPcmDownsampler(context.sampleRate, onFrame);
  processor.onaudioprocess = (event) => {
    downsampler.push(event.inputBuffer.getChannelData(0));
  };
  source.connect(processor);
  processor.connect(sink);
  let stopped = false;
  return {
    stop: async () => {
      if (stopped) return;
      stopped = true;
      processor.onaudioprocess = null;
      downsampler.flush();
      disconnect(source, processor, sink);
    },
  };
}

function disconnect(source: AudioNode, node: AudioNode, sink: AudioNode) {
  try {
    source.disconnect(node);
  } catch {
    // 이미 끊겼다
  }
  try {
    node.disconnect();
    sink.disconnect();
  } catch {
    // 이미 끊겼다
  }
}
