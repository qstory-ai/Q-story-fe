import { useSyncDemoCompletionOnAuth } from '../model/use-sync-demo-completion-on-auth';

/** 화면에 아무것도 그리지 않는다 - App 트리 안에서 딱 한 번 마운트해 훅만 돌리기 위한 용도. */
export function SyncDemoCompletionOnAuth() {
  useSyncDemoCompletionOnAuth();
  return null;
}
