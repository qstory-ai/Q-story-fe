import { useEffect, useRef } from 'react';

import { useAuth } from '@/entities/auth';
import { clearLocalStoryProgress, loadLocalStoryProgress } from '@/entities/analytics';
import { recordStoryCompletion } from '@/entities/story-completion';

/**
 * 익명 데모(/demo)를 끝까지 마치면 리포트 재료(questionOutcomes 등)가
 * localStorage에만 남는다(entities/analytics의 LocalStoryProgress) - 계정이 없어
 * 서버에 저장할 곳이 없기 때문이다. 이 훅은 이후 같은 브라우저에서 로그인/회원가입해
 * authState가 'authenticated'가 되는 순간을 감지해, 남아 있는 완료 기록을 그 계정으로
 * 대신 저장해 준다. 성공 시에만 로컬 사본을 지운다 - 실패(네트워크 등)하면 다음 로그인
 * 때 다시 시도할 수 있도록 남겨 둔다.
 */
export function useSyncDemoCompletionOnAuth() {
  const { state } = useAuth();
  const syncingRef = useRef(false);

  useEffect(() => {
    if (state.status !== 'authenticated' || syncingRef.current) {
      return;
    }
    const progress = loadLocalStoryProgress();
    if (!progress || progress.state.status !== 'complete') {
      return;
    }

    syncingRef.current = true;
    void recordStoryCompletion(state.token, {
      storyId: progress.storyId,
      durationSeconds: progress.elapsedSeconds,
      outcomes: progress.questionOutcomes,
    })
      .then(() => {
        clearLocalStoryProgress();
      })
      .catch(() => {
        // 오늘 보여준 리포트 자체는 이미 완료된 화면이라 실패를 알릴 곳이 없다 -
        // 로컬 기록을 지우지 않고 남겨 다음 로그인 때 다시 시도한다.
      })
      .finally(() => {
        syncingRef.current = false;
      });
  }, [state]);
}
