import type { RecorderPermissionState } from './types';

/**
 * 페이지 안에서 한 번 받은 마이크 권한 결과를 녹음기 인스턴스끼리 나눠 쓴다(Q-34).
 * "이야기 시작하기" 때 이야기 녹음기가 받아 두면, 그레텔 대화 녹음기도 다시 묻지 않고 자동 녹음을 시작할 수 있다.
 */
let current: RecorderPermissionState = 'unknown';
const listeners = new Set<(state: RecorderPermissionState) => void>();

export function getSharedMicPermission() {
  return current;
}

export function setSharedMicPermission(state: RecorderPermissionState) {
  if (state === current) return;
  current = state;
  listeners.forEach((listener) => listener(state));
}

export function subscribeSharedMicPermission(
  listener: (state: RecorderPermissionState) => void,
) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
