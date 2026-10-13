import { homePathForAuth, type AuthState } from '@/entities/auth';
import { MAIN_SITE_URL } from '@/shared/config';

export type ExitPlan = {
  path: string;
  /** 앱 밖으로 나갈 주소 - 있으면 path 대신 이 주소로 간다(네이티브 앱은 시스템 브라우저로 열고 앱은 path로). */
  externalUrl?: string;
  /** 이야기 도중이면 진행을 저장해 두어 돌아왔을 때 이어 듣게 한다. */
  saveProgress: boolean;
  /** 완주 후 로그인 상태라면 서버에 저장이 끝났으니 로컬 사본을 정리한다. 익명 데모는 남긴다. */
  clearProgress: boolean;
};

export type ExitOptions = {
  /** 리포트 끝 보라색 안내 상자의 "홈으로": 로그인 안 했으면 데모 첫 화면이 아니라 메인 홈페이지로 보낸다. */
  anonymousToMainSite?: boolean;
};

/** 나가기 한 곳으로 통일: 어디서 나가든 목적지와 진행 처리를 여기서 정한다. */
export function resolveExit(authState: AuthState, runtimeStatus: string, options: ExitOptions = {}): ExitPlan {
  const complete = runtimeStatus === 'complete';
  const authenticated = authState.status === 'authenticated';
  return {
    path: homePathForAuth(authState),
    ...(options.anonymousToMainSite && !authenticated ? { externalUrl: MAIN_SITE_URL } : {}),
    saveProgress: !complete,
    clearProgress: complete && authenticated,
  };
}
