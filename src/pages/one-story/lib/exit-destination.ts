import { homePathForAuth, type AuthState } from '@/entities/auth';

export type ExitPlan = {
  path: string;
  /** 이야기 도중이면 진행을 저장해 두어 돌아왔을 때 이어 듣게 한다. */
  saveProgress: boolean;
  /** 완주 후 로그인 상태라면 서버에 저장이 끝났으니 로컬 사본을 정리한다. 익명 데모는 남긴다. */
  clearProgress: boolean;
};

/** 나가기 한 곳으로 통일: 어디서 나가든 목적지와 진행 처리를 여기서 정한다. */
export function resolveExit(authState: AuthState, runtimeStatus: string): ExitPlan {
  const complete = runtimeStatus === 'complete';
  return {
    path: homePathForAuth(authState),
    saveProgress: !complete,
    clearProgress: complete && authState.status === 'authenticated',
  };
}
