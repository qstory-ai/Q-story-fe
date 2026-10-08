type Listener = () => void;
const listeners = new Set<Listener>();

/**
 * 알림 목록을 다시 불러오라는 신호. 앱이 켜져 있는 동안 푸시가 오면(features/push-notifications)
 * 이 신호를 보내고, 화면에 떠 있는 알림 벨이 받아서 목록·뱃지를 새로 고친다.
 */
export function requestNotificationRefresh(): void {
  for (const listener of listeners) listener();
}

/** 신호를 구독한다. 반환값으로 구독을 끊는다. */
export function subscribeNotificationRefresh(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
