/**
 * 녹음 중 소리 크기를 재는 AnalyserNode용 AudioContext를 페이지에 하나만 둔다(Q-34).
 * iOS Safari·Chrome은 사용자 탭 밖에서 만든 AudioContext를 'suspended'로 두므로,
 * 탭 핸들러("이야기 시작하기", "말하기")에서 primeRecorderAudio()로 미리 만들고 resume해 둔다.
 * 그래야 초대 낭독이 끝난 뒤 탭 없이 자동으로 시작한 녹음에서도 소리 크기를 읽을 수 있다.
 */
let sharedContext: AudioContext | null = null;

export function getMeteringAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!sharedContext || sharedContext.state === 'closed') {
    const AudioContextCtor =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextCtor) return null;
    try {
      sharedContext = new AudioContextCtor();
    } catch {
      return null;
    }
  }
  return sharedContext;
}

/** 사용자 탭 안에서 불러 소리 크기 측정용 AudioContext를 깨워 둔다. 실패해도 조용히 넘어간다. */
export function primeRecorderAudio() {
  const context = getMeteringAudioContext();
  if (context && context.state === 'suspended') {
    void context.resume().catch(() => {});
  }
}

/** 멈춰 있으면 깨워 본다 - 탭 밖이면 resume이 끝나지 않을 수 있어 짧게만 기다린다. */
export async function ensureMeteringRunning(context: AudioContext, waitMs = 300) {
  if (context.state === 'running') return true;
  await Promise.race([
    context.resume().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, waitMs)),
  ]);
  return (context.state as AudioContextState) === 'running';
}
