/**
 * 크롬 계열이 주는 beforeinstallprompt 이벤트를 잡아 둔다. 이 이벤트는 화면을 그리기 전에 올 수 있어서
 * main.tsx에서 먼저 듣기 시작하고, 안내 배너가 나중에 구독한다.
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function installDeferredPromptCapture(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (event) => {
    // 크롬이 자체 미니 안내 바를 띄우지 않게 막고, 우리 배너의 버튼에서 쓴다.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    notify();
  });
}

export function subscribeDeferredPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 설치 창을 띄울 수 있는 상태인지. useSyncExternalStore의 스냅샷으로 쓴다. */
export function hasDeferredPrompt(): boolean {
  return deferred !== null && !installed;
}

/** 브라우저 설치 창을 띄운다. 이벤트는 한 번만 쓸 수 있어 쓰고 나면 비운다. */
export async function showDeferredPrompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = deferred;
  if (!event) return 'unavailable';
  deferred = null;
  notify();
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome;
}
