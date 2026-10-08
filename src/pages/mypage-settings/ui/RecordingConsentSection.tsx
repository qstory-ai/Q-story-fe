import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ErrorState, LoadingState, Modal, StatusBanner, SwitchField, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { recordingConsentStore, useRecordingConsent } from '@/entities/analytics';

type Notice = { variant: 'success' | 'warning'; label: string };

/**
 * 마이페이지 "설정"의 화면 녹화·화면 이용 기록 카드(모든 역할). 계정 단위로 저장한다.
 * - 화면 녹화 허용: 끄면 서버가 이 계정의 저장된 녹화를 지운다 - 확인 팝업을 거친다.
 * - 화면 이용 기록 수집(누른 곳·스크롤): 기본으로 켜져 있고, 끄면 이 계정의 기록을 모으지 않는다.
 */
export function RecordingConsentSection({ token }: { token: string }) {
  const consent = useRecordingConsent();
  const recording = consent.account.recording;
  const tracking = consent.account.tracking;
  const loaded = recording !== undefined && tracking !== undefined;
  // 처음에는 불러오는 중으로 본다 - 로그인할 때 시작한 요청이 아직 오고 있을 수 있다.
  const [loadState, setLoadState] = useState<'loading' | 'idle'>(loaded ? 'idle' : 'loading');
  const [saving, setSaving] = useState<'recording' | 'tracking' | null>(null);
  const [confirmingOff, setConfirmingOff] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function reload() {
    setLoadState('loading');
    await recordingConsentStore().refreshAccount();
    setLoadState('idle');
  }

  // 로그인할 때 불러오지 못했으면(네트워크 등) 이 화면을 열 때 한 번 더 불러온다.
  useEffect(() => {
    if (!consent.loggedIn || loaded) return;
    let cancelled = false;
    void recordingConsentStore()
      .refreshAccount()
      .finally(() => {
        if (!cancelled) setLoadState('idle');
      });
    return () => {
      cancelled = true;
    };
    // 화면을 열 때 한 번만 - 실패하면 "다시 시도"로 부른다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consent.loggedIn]);

  async function saveRecording(granted: boolean) {
    setSaving('recording');
    setActionError(null);
    setNotice(null);
    try {
      await recordingConsentStore().setAccountRecording(token, granted);
      setConfirmingOff(false);
      setNotice({
        variant: 'success',
        label: granted ? '화면 녹화를 허용했어요. 고마워요!' : '화면 녹화를 끄고 저장된 화면 녹화를 지웠어요.',
      });
    } catch (error: unknown) {
      const message = messageForError(error, '설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
      if (granted) setNotice({ variant: 'warning', label: message });
      else setActionError(message);
    } finally {
      setSaving(null);
    }
  }

  async function saveTracking(enabled: boolean) {
    setSaving('tracking');
    setNotice(null);
    try {
      await recordingConsentStore().setAccountTracking(token, enabled);
    } catch (error: unknown) {
      setNotice({ variant: 'warning', label: messageForError(error, '설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.') });
    } finally {
      setSaving(null);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>화면 녹화와 이용 기록</Text>
      <Text style={styles.body}>
        서비스를 다듬기 위해 쓰고 1년 보관해요. 입력한 글자는 가려요. 꺼도 서비스는 똑같이 이용할 수 있어요.
      </Text>

      {!loaded && loadState === 'loading' ? (
        <LoadingState compact label="설정을 불러오는 중이에요…" />
      ) : !loaded ? (
        <ErrorState message="설정을 불러오지 못했어요." onRetry={() => void reload()} />
      ) : (
        <View style={styles.switches}>
          <SwitchField
            label="화면 녹화 허용"
            description={
              recording === null
                ? '아직 정하지 않았어요. 켜기 전에는 녹화하지 않아요.'
                : '이야기를 읽는 화면을 녹화해 어디서 어려웠는지 살펴봐요. 끄면 저장된 화면 녹화를 지워요.'
            }
            checked={recording === true}
            onChange={(next) => {
              if (next) void saveRecording(true);
              else {
                setActionError(null);
                setConfirmingOff(true);
              }
            }}
            disabled={saving !== null}
          />
          <SwitchField
            label="화면 이용 기록 수집"
            description="누른 곳·스크롤 같은 화면 이용 기록을 모아요. 끄면 이 계정의 기록을 모으지 않아요."
            checked={tracking !== false}
            onChange={(next) => void saveTracking(next)}
            disabled={saving !== null}
          />
        </View>
      )}

      {notice ? <StatusBanner variant={notice.variant} label={notice.label} /> : null}

      <Modal
        visible={confirmingOff}
        accessibilityLabel="화면 녹화 허용 끄기 확인"
        title="화면 녹화를 끌까요?"
        positiveAction={{
          label: saving === 'recording' ? '지우는 중…' : '끄고 녹화 지우기',
          onPress: () => void saveRecording(false),
          disabled: saving !== null,
          loading: saving === 'recording',
        }}
        negativeAction={{ label: '취소', onPress: () => setConfirmingOff(false), disabled: saving !== null }}
      >
        <Text style={styles.modalBody}>저장된 화면 녹화를 지워요. 지운 녹화는 되돌릴 수 없어요.</Text>
        {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    padding: storybookTheme.spacing.ml,
    gap: storybookTheme.spacing.xs,
  },
  sectionTitle: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  body: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onCardBody,
  },
  switches: { gap: storybookTheme.spacing.ms, marginTop: storybookTheme.spacing.xs },
  modalBody: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.onCardBody,
    textAlign: 'center',
  },
  errorText: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.error,
    textAlign: 'center',
  },
});
