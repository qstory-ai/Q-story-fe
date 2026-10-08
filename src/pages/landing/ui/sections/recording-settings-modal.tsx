import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { recordingConsentStore, useRecordingConsent } from '@/entities/analytics';
import { Modal, SwitchField, storybookTheme } from '@/shared/ui';

/**
 * 공개 화면 바닥글의 "기록 설정" - 로그인하지 않은 방문자가 이 기기의 화면 녹화·이용 기록을 켜고 끈다.
 * 녹화를 끄면 이 통계 세션의 저장된 녹화를 서버에서 지운다. 로그인한 사람은 마이페이지 설정을 쓴다.
 */
export function RecordingSettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const consent = useRecordingConsent();
  const [message, setMessage] = useState<string | null>(null);
  const recording = consent.local?.granted === true;

  return (
    <Modal visible={visible} title="기록 설정" accessibilityLabel="화면 녹화와 이용 기록 설정" linkAction={{ label: '닫기', onPress: onClose }}>
      <View style={styles.body}>
        <Text style={styles.lead}>
          서비스를 다듬기 위해 쓰고 1년 보관해요. 입력한 글자는 가려요. 꺼도 똑같이 이용할 수 있어요.
        </Text>
        <SwitchField
          label="화면 녹화 허용"
          description="허용한 경우에만 화면을 녹화해요. 끄면 이 기기에서 저장된 화면 녹화를 지워요."
          checked={recording}
          onChange={(next) => {
            void recordingConsentStore().setLocalRecording(next);
            setMessage(next ? '화면 녹화를 허용했어요.' : '화면 녹화를 끄고 저장된 화면 녹화를 지워요.');
          }}
        />
        <SwitchField
          label="화면 이용 기록 수집"
          description="누른 곳·스크롤 같은 화면 이용 기록이에요. 끄면 모으지 않아요."
          checked={consent.localTracking}
          onChange={(next) => {
            recordingConsentStore().setLocalTracking(next);
            setMessage(next ? '화면 이용 기록을 다시 모아요.' : '화면 이용 기록을 모으지 않아요.');
          }}
        />
        {message ? (
          <Text style={styles.message} accessibilityLiveRegion="polite">
            {message}
          </Text>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  body: { gap: storybookTheme.spacing.ms },
  lead: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onCardBody,
  },
  message: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onCardMuted,
    textAlign: 'center',
  },
});
