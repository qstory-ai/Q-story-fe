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

/**
 * 나가기 한 곳으로 통일: 어디서 나가든 목적지와 진행 처리를 여기서 정한다.
 * 로그인 안 한 체험(데모)은 어느 "홈"을 눌러도 메인 홈페이지(qstory.ai.kr)로 간다 - 리포트의 "홈으로"만 그랬고
 * 완주 화면 "홈으로 돌아가기"·상단 "홈"은 앱 첫 화면(로그인·가입)으로 가서 헷갈렸다(10/24 대표 QA).
 */
export function resolveExit(authState: AuthState, runtimeStatus: string): ExitPlan {
  const complete = runtimeStatus === 'complete';
  const authenticated = authState.status === 'authenticated';
  return {
    path: homePathForAuth(authState),
    ...(authenticated ? {} : { externalUrl: MAIN_SITE_URL }),
    saveProgress: !complete,
    clearProgress: complete && authenticated,
  };
}
