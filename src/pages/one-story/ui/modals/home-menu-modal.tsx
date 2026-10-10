import { ActionButton, Modal } from '@/shared/ui';
import { SessionCodeNote } from '@/entities/play-session';

import type { OneStoryRuntime } from '../../model';

/**
 * 나가기 확인(Q-34): "계속 듣기 / 나가기" 두 개뿐. 나가면 진행이 저장돼 다시 오면 이어 들을 수 있다.
 * 자막 숨기기/보이기는 재생 버튼 줄에서 빼고 여기 작은 글자 버튼으로 둔다(자막은 기본으로 켜져 있다).
 * 아래 RestartConfirmModal은 "처음부터 다시" 확인 - 기록이 지워지므로 한 번 더 묻는다.
 */
export function HomeMenuModal({ runtime }: { runtime: OneStoryRuntime }) {
  const {
    homeMenuVisible,
    continueFromHomeMenu,
    leaveStory,
    restartConfirmVisible,
    cancelRestart,
    confirmRestart,
    sessionCode,
    captionVisible,
    setCaptionVisible,
  } = runtime;

  return (
    <>
      <Modal
        visible={homeMenuVisible}
        eyebrow="이야기 홈"
        title="이야기를 그만 들을까요?"
        accessibilityLabel="이야기 홈 메뉴"
        linkAction={{
          label: captionVisible ? '자막 숨기기' : '자막 보이기',
          onPress: () => setCaptionVisible((visible) => !visible),
        }}
      >
        <ActionButton variant="primary" label="계속 듣기" onPress={continueFromHomeMenu} />
        <ActionButton variant="secondaryFull" label="나가기" onPress={leaveStory} />
        <SessionCodeNote code={sessionCode} />
      </Modal>
      <Modal
        visible={restartConfirmVisible}
        eyebrow="처음부터"
        title="처음부터 다시 들을까요?"
        positiveAction={{ label: '처음부터 듣기', onPress: confirmRestart }}
        negativeAction={{ label: '아니요', onPress: cancelRestart }}
        accessibilityLabel="처음부터 다시 듣기 확인"
      />
    </>
  );
}
