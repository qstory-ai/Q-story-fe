import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { recordingConsentStore } from '@/entities/analytics';
import { storybookTheme } from '@/shared/ui';

/**
 * 이야기 시작 화면의 화면 녹화 묻기 - 막는 팝업이 아니라 시작 버튼 위의 작은 카드.
 * 기기·계정마다 한 번만 묻는다(recording-consent.ts의 needsPrompt). 답하지 않고 시작해도 되고, 그러면 녹화하지 않는다.
 */
export function RecordingConsentCard() {
  const [saving, setSaving] = useState(false);

  function answer(granted: boolean) {
    if (saving) return;
    setSaving(true);
    // 답을 고르는 즉시 카드는 사라진다(이 기기에 먼저 저장) - 서버 저장은 뒤에서 한다.
    void recordingConsentStore()
      .answerPrompt(granted)
      .finally(() => setSaving(false));
  }

  return (
    <View style={styles.card} accessibilityRole="summary" accessibilityLabel="화면 녹화 허용 묻기">
      <Text style={styles.body}>
        더 좋은 이야기를 만들기 위해 화면을 녹화해도 될까요? 1년 보관하고, 입력한 글자는 가려요. 허용하지 않아도
        똑같이 이용할 수 있어요.
      </Text>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="화면 녹화 허용"
          onPress={() => answer(true)}
          disabled={saving}
          style={({ pressed }) => [styles.button, styles.allow, pressed && styles.pressed]}
        >
          <Text style={[styles.label, styles.allowLabel]}>허용</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="화면 녹화 괜찮아요(허용 안 함)"
          onPress={() => answer(false)}
          disabled={saving}
          style={({ pressed }) => [styles.button, styles.decline, pressed && styles.pressed]}
        >
          <Text style={[styles.label, styles.declineLabel]}>괜찮아요</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    backgroundColor: '#F7F1FA',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  body: {
    color: '#4E3267',
    fontSize: storybookTheme.type.xs,
    lineHeight: 19,
  },
  actions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  button: {
    minHeight: 36,
    minWidth: 76,
    paddingHorizontal: 14,
    borderRadius: storybookTheme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allow: { backgroundColor: storybookTheme.color.primary },
  decline: { backgroundColor: storybookTheme.color.surfaceWhite, borderWidth: 1, borderColor: '#D8C8E2' },
  pressed: { opacity: 0.8 },
  label: { fontSize: storybookTheme.type.sm, fontWeight: storybookTheme.type.weight.bold },
  allowLabel: { color: storybookTheme.color.surfaceWhite },
  declineLabel: { color: '#4E3267' },
});
