import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import {
  fallbackFamilyId,
  type StoryRuntimeEvent,
  type StoryRuntimeState,
} from '@/entities/story-runtime';
import {
  getLiveBranchJobStatus,
  type LiveBranchOption,
} from '@/entities/live-branch';
import { refetchStoryPackage, type StoryRuntimePackage } from '@/entities/story';
import type { BetaEventName } from '@/entities/analytics';

import {
  LIVE_BRANCH_POLL_INTERVAL_MS,
  LIVE_BRANCH_POLL_TIMEOUT_MS,
} from '../lib/constants';

interface UseLiveBranchPollingParams {
  runtimeState: StoryRuntimeState;
  storyId: string;
  commitEvent: (event: StoryRuntimeEvent) => boolean;
  trackStoryEvent: (
    eventName: BetaEventName,
    metadata?: Record<string, string | number | boolean>,
  ) => void;
  setStoryPackage: Dispatch<SetStateAction<StoryRuntimePackage>>;
}

/**
 * 실시간 새 분기 생성(LiveBranchGenerationService) 폴링 - runtime이 'generating-branch'로
 * 들어가면(RESPONSE_READY 처리부에서 plan.liveBranchJobId를 봤을 때) 시작한다.
 * GET /v1/live-branch/{jobId}를 주기적으로 확인하다가:
 *  - READY: GET /v1/stories/{storyId}/content를 재조회해 새 family/segment/asset이 포함된
 *    패키지로 storyPackage를 교체한 뒤, LIVE_BRANCH_READY를 보내 정확히 3개의 옵션으로
 *    구성된 THREE_PATHS 선택 화면을 띄운다(runtime.ts 참고 - Phase 2부터는 자동재생하지
 *    않고 아이가 직접 고른다. 실제 선택은 selectRouteOption이 이미 처리).
 *  - FAILED, 응답 모양이 어긋남(옵션이 3개가 아님), 또는 60초 타임아웃: LIVE_BRANCH_FAILED를
 *    보내 기존 GENTLE_REDIRECT 흐름으로 안전하게 이야기를 계속한다.
 */
export function useLiveBranchPolling({
  runtimeState,
  storyId,
  commitEvent,
  trackStoryEvent,
  setStoryPackage,
}: UseLiveBranchPollingParams) {
  useEffect(() => {
    if (runtimeState.status !== 'generating-branch') {
      return;
    }
    const { jobId, anchorId, sceneId } = runtimeState;
    // settled: 최종 상태(성공/실패)에 도달했다는 표시로 여러 곳에서 확인한다. pollInFlight는
    // 그와 별개로, poll() 한 번이 READY/FAILED를 발견해 succeedWith/failGently의 비동기 뒷정리를
    // 시작한 "직후"부터 즉시 true가 된다 - succeedWith는 refetchStoryPackage를 기다리는 동안
    // await로 한 번 양보하는데, 그 사이에도 setInterval의 다음 tick이 이미 예약되어 있었다면
    // settled가 아직 false라서 poll()이 다시 들어와 같은 무거운 refetch를 중복으로 쏠 수 있다.
    // pollInFlight를 READY/FAILED를 본 그 순간(await 이전) 동기적으로 세워 이걸 막는다.
    let settled = false;
    let pollInFlight = false;
    const controller = new AbortController();

    const failGently = () => {
      if (settled) return;
      settled = true;
      commitEvent({ type: 'LIVE_BRANCH_FAILED' });
      void trackStoryEvent('question_result', {
        anchor_id: anchorId,
        scene_id: sceneId,
        route: 'GENTLE_REDIRECT',
        result: 'live_branch_failed',
      });
    };

    const succeedWith = async (options: LiveBranchOption[]) => {
      if (settled) return;
      try {
        const refreshedPackage = await refetchStoryPackage(storyId);
        if (settled || controller.signal.aborted) {
          return;
        }
        setStoryPackage(refreshedPackage);
        settled = true;
        commitEvent({
          type: 'LIVE_BRANCH_READY',
          options: options.map((option) => ({
            familyId: fallbackFamilyId(option.familyId),
            label: option.label,
            meaning: option.meaning,
          })),
        });
        // 아직 아이가 고른 게 아니다 - 실제 선택은 selectRouteOption이 처리하며 그때
        // rememberQuestionOutcome/choice_selected가 정상 경로로 기록된다. 여기서는 선택지가
        // 새로 준비되었다는 사실만 남긴다.
        void trackStoryEvent('question_result', {
          anchor_id: anchorId,
          scene_id: sceneId,
          route: 'THREE_PATHS',
          result: 'live_branch_ready',
          family_ids: options.map((option) => option.familyId).join(','),
        });
      } catch {
        // 콘텐츠 재조회 자체가 실패하면(네트워크 등) 새 콘텐츠를 아이에게 보여줄 방법이
        // 없으니, 이미 있는 안전한 경로(GENTLE_REDIRECT)로 넘어간다.
        failGently();
      }
    };

    const poll = async () => {
      if (pollInFlight || settled) {
        return;
      }
      try {
        const status = await getLiveBranchJobStatus(jobId, controller.signal);
        if (settled || controller.signal.aborted) {
          return;
        }
        if (status.status === 'READY') {
          if (status.options && status.options.length === 3) {
            pollInFlight = true;
            await succeedWith(status.options);
          } else {
            // 계약대로라면 READY는 항상 정확히 3개를 동반한다 - 어긋나면 안전하게 넘어간다.
            failGently();
          }
          return;
        }
        if (status.status === 'FAILED') {
          failGently();
        }
        // QUEUED/GENERATING이면 다음 tick에서 다시 확인한다.
      } catch {
        if (controller.signal.aborted) {
          return;
        }
        // 폴링 요청 하나가 실패해도 곧바로 포기하지 않는다 - 60초 타임아웃이 최종 안전망이다.
      }
    };

    void poll();
    const intervalId = setInterval(() => {
      void poll();
    }, LIVE_BRANCH_POLL_INTERVAL_MS);
    const timeoutId = setTimeout(failGently, LIVE_BRANCH_POLL_TIMEOUT_MS);

    return () => {
      settled = true;
      controller.abort();
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [commitEvent, runtimeState, storyId, trackStoryEvent, setStoryPackage]);
}
