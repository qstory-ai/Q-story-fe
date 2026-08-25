import { Modal, ModalBody } from '@/shared/ui';

import type { OneStoryRuntime } from '../../model';

export function ResumeModal({ runtime }: { runtime: OneStoryRuntime }) {
  const {
    runtimeState,
    resumeCandidate,
    resumeStory,
    dismissResumeAndRestart,
    getSceneIndex,
  } = runtime;

  const visible = runtimeState.status === 'idle' && Boolean(resumeCandidate);

  return (
    <Modal
      visible={visible}
      eyebrow="저장된 이야기"
      title={
        resumeCandidate
          ? `${getSceneIndex(resumeCandidate.state) + 1}번째 장면부터\n이어서 들을까요?`
          : undefined
      }
      positiveAction={{ label: '이어서 듣기', onPress: resumeStory }}
      negativeAction={{ label: '처음부터 읽기', onPress: dismissResumeAndRestart }}
      accessibilityLabel="저장된 이야기 이어듣기"
    >
      <ModalBody>
        이 기기의 브라우저에만 진행 상황을 저장했어요. 녹음 파일과 확인 전
        문장은 저장하지 않았어요.
      </ModalBody>
    </Modal>
  );
}
