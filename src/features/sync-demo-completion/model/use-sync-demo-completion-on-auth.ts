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
    // 로그인한 채로 끝까지 읽은 회차도 완료 상태로 기기에 남아 있다 - 그 회차는 이미 서버에 저장됐으므로 같은 회차 id를
    // 실어 보내 서버가 새 기록을 만들지 않고 그 기록을 갱신하게 한다(같은 회차 id·같은 사용자면 갱신). 회차 id가 없는
    // 예전 데모 기록만 새로 저장된다.
    void recordStoryCompletion(state.token, {
      storyId: progress.storyId,
      durationSeconds: progress.elapsedSeconds,
      outcomes: progress.questionOutcomes,
      ...(progress.sessionId ? { companionConversationId: progress.sessionId } : {}),
      ...(progress.childId ? { childId: progress.childId } : {}),
      ...(progress.readFromSceneId ? { readFromSceneId: progress.readFromSceneId } : {}),
      ...(progress.readThroughSceneId ? { readThroughSceneId: progress.readThroughSceneId } : {}),
      endStatus: 'COMPLETED',
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
