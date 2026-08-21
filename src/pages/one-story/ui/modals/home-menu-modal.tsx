import { Pressable, Text, View } from 'react-native';

import { ActionButton } from '@/shared/ui';

import type { OneStoryRuntime } from '../../model';
import { styles } from '../styles';

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

  if (!homeMenuVisible) {
    return null;
  }

  return (
    <View style={styles.modalScrim} accessibilityViewIsModal>
      <View style={styles.modalCard}>
        <Text style={styles.modalEyebrow}>이야기 홈</Text>
        <Text style={styles.modalTitle}>이야기를 어떻게 할까요?</Text>
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
      </View>
    </View>
  );
}
