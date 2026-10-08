import { useEffect, useRef } from 'react';

import { useAuth } from '@/entities/auth';
import { clearAnonymousLocalStoryProgress, loadAnonymousLocalStoryProgress } from '@/entities/analytics';
import { listChildren } from '@/entities/child';
import { recordStoryCompletion } from '@/entities/story-completion';

import { decideDemoSync } from './sync-guard';

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
    const progress = loadAnonymousLocalStoryProgress();
    if (!progress || progress.state.status !== 'complete') {
      return;
    }

    syncingRef.current = true;
    const token = state.token;
    const role = state.user.role;
    // 로그인한 채로 끝까지 읽은 회차도 완료 상태로 기기에 남아 있다 - 그 회차는 이미 서버에 저장됐으므로 같은 회차 id를
    // 실어 보내 서버가 새 기록을 만들지 않고 그 기록을 갱신하게 한다(같은 회차 id·같은 사용자면 갱신). 회차 id가 없는
    // 예전 데모 기록만 새로 저장된다.
    // childId가 있는 기록은 이 사용자의 아이일 때만 옮기고, 아니면 버린다. 아이 목록을 못 불러오면
    // 판단할 수 없으니 기록을 남겨 두고 다음 로그인 때 다시 본다.
    const upload = () => {
      return recordStoryCompletion(token, {
        storyId: progress.storyId,
        durationSeconds: progress.elapsedSeconds,
        outcomes: progress.questionOutcomes,
        ...(progress.sessionId ? { companionConversationId: progress.sessionId } : {}),
        ...(progress.childId ? { childId: progress.childId } : {}),
        ...(progress.readFromSceneId ? { readFromSceneId: progress.readFromSceneId } : {}),
        ...(progress.readThroughSceneId ? { readThroughSceneId: progress.readThroughSceneId } : {}),
        endStatus: 'COMPLETED',
      }).then(() => {
        clearAnonymousLocalStoryProgress();
      });
    };
    const ownChildIds =
      progress.childId && role === 'PARENT'
        ? listChildren(token).then((list) => list.map((child) => child.id))
        : Promise.resolve<string[]>([]);
    void ownChildIds
      .then((ids) => {
        if (decideDemoSync(progress, ids) === 'discard') {
          clearAnonymousLocalStoryProgress();
          return;
        }
        return upload();
      })
      .catch(() => {
        // 아이 목록 조회 실패 - 기록은 그대로 두고 다음 기회에.
      })
      .finally(() => {
        syncingRef.current = false;
      });

  }, [state]);
}
