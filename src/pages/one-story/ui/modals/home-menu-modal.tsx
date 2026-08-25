import { Pressable, Text, View } from 'react-native';

import { ActionButton, Modal } from '@/shared/ui';

import type { OneStoryRuntime } from '../../model';
import { styles } from '../styles';

/**
 * 1단계(계속 듣기/잠시 나가기 + 링크)와 2단계(가변 개수 exitReason 리스트 + 링크)를
 * 오가는 미니 위저드라서, Modal의 positiveAction/negativeAction 슬롯(고정 2버튼)에
 * 억지로 끼워 맞추지 않는다 - Modal은 크롬(스크림+카드+애니메이션)만 맡고, 단계별
 * 마크업은 그대로 children으로 둔다.
 */
export function HomeMenuModal({ runtime }: { runtime: OneStoryRuntime }) {
  const {
    homeMenuVisible,
    exitReasonVisible,
    setExitReasonVisible,
    continueFromHomeMenu,
    leaveTemporarily,
    finishToday,
    exitReasons,
  } = runtime;

  return (
    <Modal visible={homeMenuVisible} eyebrow="이야기 홈" title="이야기를 어떻게 할까요?" accessibilityLabel="이야기 홈 메뉴">
      {!exitReasonVisible ? (
        <>
          <ActionButton
            variant="primary"
            label="계속 듣기"
            onPress={continueFromHomeMenu}
          />
          <ActionButton
            variant="secondaryFull"
            label="잠시 나가기"
            onPress={leaveTemporarily}
          />
          <Pressable
            style={styles.modalTextButton}
            onPress={() => setExitReasonVisible(true)}
          >
            <Text style={styles.modalTextButtonLabel}>오늘 체험 마치기</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.modalBody}>
            오늘 여기서 마치는 가장 큰 이유 하나만 알려주세요. 선택하지
            않고 돌아갈 수도 있어요.
          </Text>
          <View style={styles.exitReasonList}>
            {exitReasons.map((reason) => (
              <Pressable
                key={reason}
                style={styles.exitReasonButton}
                onPress={() => finishToday(reason)}
              >
                <Text style={styles.exitReasonButtonText}>{reason}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            style={styles.modalTextButton}
            onPress={() => setExitReasonVisible(false)}
          >
            <Text style={styles.modalTextButtonLabel}>이야기로 돌아가기</Text>
          </Pressable>
        </>
      )}
    </Modal>
  );
}
