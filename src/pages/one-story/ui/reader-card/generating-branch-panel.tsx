import type { OneStoryRuntime } from '../../model';
import { LoadingPanel } from './loading-panel';

/**
 * "generating-branch" 상태 전용 로딩 화면 - 아이의 질문이 기존 선택지 어디에도 맞지 않아
 * 백엔드가 실시간으로 새 분기(대본+삽화)를 만드는 동안 보여준다 (use-one-story-runtime.ts의
 * 폴링 effect가 GET /v1/live-branch/{jobId}를 확인하는 중). 최대 60초 안에 READY(새 분기 재생)
 * 또는 FAILED/타임아웃(안전하게 이야기 계속)으로 항상 끝나므로, processing-panel과 달리
 * "질문 다시 하기/건너뛰기" 같은 탈출 버튼을 두지 않는다.
 */
export function GeneratingBranchPanel({ runtime }: { runtime: OneStoryRuntime }) {
  const { runtimeState } = runtime;

  if (runtimeState.status !== 'generating-branch') {
    return null;
  }

  return (
    <LoadingPanel
      title={
        <>
          헨젤과 그레텔이{'\n'}
          새로운 이야기를 만들고 있어요
        </>
      }
      body="조금 특별한 질문이라 준비하는 데 시간이 걸려요. 다 되면 바로 들려줄게요."
    />
  );
}
