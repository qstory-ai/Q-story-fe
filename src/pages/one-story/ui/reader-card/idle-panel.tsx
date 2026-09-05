import { Pressable, Text, TextInput, View } from 'react-native';

import { hasKoreanBatchim } from '@/entities/narration';
import { ActionButton, storybookTheme } from '@/shared/ui';

import type { OneStoryRuntime } from '../../model';
import { styles } from '../styles';

export function IdlePanel({ runtime }: { runtime: OneStoryRuntime }) {
  const {
    runtimeState,
    childNameInput,
    setChildNameInput,
    selectedChildName,
    startStory,
    voiceResearchConsentChecked,
    setVoiceResearchConsentChecked,
  } = runtime;

  if (runtimeState.status !== 'idle') {
    return null;
  }

  return (
    <View style={styles.contentGroup}>
      <Text style={styles.heroTitle}>
        아이가 질문하면{'\n'}이야기가 귀 기울여요
      </Text>
      <Text style={styles.introBody}>
        부모님과 아이가 한 화면에서 듣고, 말하고, 선택하며 끝까지 함께
        읽는 이야기예요.
      </Text>
      {selectedChildName ? (
        // 홈에서 이미 아이를 고르고 들어온 경로 - 방금 고른 이름을 여기서 또 타이핑하게 하지
        // 않는다. 이름 확인 문구만 보여주고 바로 시작하기로 넘어간다.
        <Text style={styles.nameKnownText}>
          {selectedChildName}{hasKoreanBatchim(selectedChildName) ? '이' : '가'} 이야기를
          시작해요{'\n'}세 번의 질문 순간에 이 이름을 불러요.
        </Text>
      ) : (
        <View style={styles.nameField}>
          <Text style={styles.nameLabel}>이야기에서 부를 이름 (선택)</Text>
          <TextInput
            value={childNameInput}
            onChangeText={(value) =>
              setChildNameInput(value.replace(/\s{2,}/g, ' ').slice(0, 10))
            }
            placeholder="예: 하윤"
            placeholderTextColor={storybookTheme.color.onLightMuted}
            maxLength={10}
            autoCorrect={false}
            returnKeyType="done"
            style={styles.nameInput}
            onSubmitEditing={startStory}
            accessibilityLabel="이야기에서 부를 이름 (선택)"
          />
          <Text style={styles.nameHint}>
            이름은 세 번의 질문 순간에만 불러요. 비워두면 ‘친구’라고 불러요.
          </Text>
        </View>
      )}
      <ActionButton variant="primary" label="이야기 시작하기" onPress={startStory} />
      <Text style={styles.parentHint}>
        목소리는 문장으로 바뀐 뒤 한 번 확인하고 질문으로 전송돼요. 확인한
        질문 문장은 이름·연락처를 가리고 서비스 개선을 위해 90일 보관해요.
      </Text>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: voiceResearchConsentChecked }}
        accessibilityLabel="보호자 음성 연구 저장 동의"
        onPress={() => setVoiceResearchConsentChecked((checked) => !checked)}
        style={styles.voiceConsentRow}
      >
        <View
          style={[
            styles.voiceConsentBox,
            voiceResearchConsentChecked && styles.voiceConsentBoxChecked,
          ]}
        >
          {voiceResearchConsentChecked && (
            <Text style={styles.voiceConsentCheck}>✓</Text>
          )}
        </View>
        <Text style={styles.voiceConsentText}>
          <Text style={styles.voiceConsentLabel}>[보호자 동의]</Text>{' '}
          아이의 질문 원음을 Q-Story 음성 인식 개선을 위해 90일간 비공개
          저장합니다. 동의하지 않아도 질문 문장으로 체험할 수 있고, 원음은
          저장되지 않아요.
        </Text>
      </Pressable>
    </View>
  );
}
