import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton, ErrorState, LoadingState, Modal, StatusBanner, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import {
  VOICE_RESEARCH_CONSENT_TERMS,
  getVoiceResearchAccountConsent,
  grantVoiceResearchAccountConsent,
  withdrawStoredVoiceResearchConsents,
  withdrawVoiceResearchAccountConsent,
  type VoiceResearchAccountConsent,
} from '@/entities/analytics';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; consent: VoiceResearchAccountConsent }
  | { status: 'error'; message: string };

type Notice = { variant: 'success' | 'warning'; label: string };

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value));
}

function statusDetail(consent: VoiceResearchAccountConsent) {
  if (consent.enabled) {
    return consent.consentedAt
      ? `${formatDate(consent.consentedAt)}에 동의했어요.`
      : '기본 설정으로 저장하고 있어요. 마이페이지에서 따로 동의한 기록은 없어요.';
  }
  return consent.withdrawnAt ? `${formatDate(consent.withdrawnAt)}에 동의를 철회했어요.` : '동의하지 않은 상태예요.';
}

/**
 * 마이페이지 "개인정보 및 데이터"의 음성 연구 저장 동의 카드(보호자 전용). 현재 상태와 동의/철회
 * 시각을 보여 주고, 철회(저장된 녹음 삭제)와 다시 동의(이야기 화면 체크박스와 같은 문구·버전)를 한다.
 * 철회는 되돌릴 수 없는 삭제라 확인 팝업을 거친다.
 */
export function VoiceResearchConsentSection({ token }: { token: string }) {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [confirmingWithdraw, setConfirmingWithdraw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let cancelled = false;
    getVoiceResearchAccountConsent(token)
      .then((consent) => {
        if (cancelled) return;
        setLoad({ status: 'ready', consent });
        // 철회한 계정인데 이 기기에 지우지 못한 세션 동의가 남아 있으면(지난 철회 때 네트워크 오류 등)
        // 조용히 다시 정리한다.
        if (!consent.enabled) void withdrawStoredVoiceResearchConsents();
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoad({ status: 'error', message: messageForError(error, '음성 연구 동의 상태를 불러오지 못했어요.') });
      });
    return () => {
      cancelled = true;
    };
  }, [token, reloadKey]);

  async function withdraw() {
    setSaving(true);
    setActionError(null);
    try {
      const consent = await withdrawVoiceResearchAccountConsent(token);
      // 계정에 연결되지 않은 녹음(로그인 전에 올렸거나 예전에 올린 것)은 이 기기의 삭제 토큰으로 지운다.
      const remaining = await withdrawStoredVoiceResearchConsents();
      setLoad({ status: 'ready', consent });
      setConfirmingWithdraw(false);
      setNotice(
        remaining > 0
          ? {
              variant: 'warning',
              label: '동의를 철회했어요. 이 기기에 남은 녹음 일부를 아직 지우지 못해, 다음에 이 화면을 열 때 다시 지울게요.',
            }
          : { variant: 'success', label: '동의를 철회하고 저장된 녹음을 삭제했어요.' },
      );
    } catch (error: unknown) {
      setActionError(messageForError(error, '동의를 철회하지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setSaving(false);
    }
  }

  async function grant() {
    setSaving(true);
    setNotice(null);
    try {
      const consent = await grantVoiceResearchAccountConsent(token);
      setLoad({ status: 'ready', consent });
      setNotice({ variant: 'success', label: '동의했어요. 다음 이야기부터 질문 원음을 저장해요.' });
    } catch (error: unknown) {
      setNotice({ variant: 'warning', label: messageForError(error, '동의를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.') });
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>음성 연구 저장 동의</Text>
      <Text style={styles.body}>{VOICE_RESEARCH_CONSENT_TERMS}</Text>

      {load.status === 'loading' ? (
        <LoadingState compact label="동의 상태를 불러오는 중이에요…" />
      ) : load.status === 'error' ? (
        <ErrorState message={load.message} onRetry={() => setReloadKey((n) => n + 1)} />
      ) : (
        <>
          <View style={styles.statusRow}>
            <View style={[styles.statusPill, load.consent.enabled ? styles.statusOn : styles.statusOff]}>
              <Text style={[styles.statusLabel, load.consent.enabled ? styles.statusLabelOn : styles.statusLabelOff]}>
                {load.consent.enabled ? '동의함 · 저장 중' : '동의 안 함 · 저장 안 함'}
              </Text>
            </View>
          </View>
          <Text style={styles.detail}>{statusDetail(load.consent)}</Text>
          {load.consent.enabled ? (
            <>
              <Text style={styles.detail}>
                철회하면 지금까지 저장된 아이의 질문 녹음을 바로 삭제하고, 이후로는 저장하지 않아요.
              </Text>
              <ActionButton
                variant="secondary"
                size="sm"
                label="동의 철회하기"
                onPress={() => {
                  setActionError(null);
                  setNotice(null);
                  setConfirmingWithdraw(true);
                }}
                disabled={saving}
              />
            </>
          ) : (
            <ActionButton
              variant="gold"
              size="sm"
              label={saving ? '저장 중…' : '위 내용에 동의하기'}
              onPress={grant}
              disabled={saving}
              loading={saving}
            />
          )}
        </>
      )}

      {notice ? <StatusBanner variant={notice.variant} label={notice.label} /> : null}

      <Modal
        visible={confirmingWithdraw}
        accessibilityLabel="음성 연구 저장 동의 철회 확인"
        title="음성 연구 저장 동의를 철회할까요?"
        positiveAction={{
          label: saving ? '삭제 중…' : '철회하고 녹음 삭제',
          onPress: withdraw,
          disabled: saving,
          loading: saving,
        }}
        negativeAction={{ label: '취소', onPress: () => setConfirmingWithdraw(false), disabled: saving }}
      >
        <Text style={styles.modalBody}>
          이 계정과 이 기기에서 저장된 아이의 질문 녹음을 모두 삭제하고, 앞으로는 저장하지 않아요. 삭제한
          녹음은 되돌릴 수 없어요. 질문 문장으로 이야기를 즐기는 데는 영향이 없어요.
        </Text>
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
  statusRow: { flexDirection: 'row', marginTop: storybookTheme.spacing.xs },
  statusPill: {
    paddingHorizontal: storybookTheme.spacing.ms,
    paddingVertical: 4,
    borderRadius: storybookTheme.radius.pill,
  },
  statusOn: { backgroundColor: storybookTheme.color.primary },
  statusOff: { backgroundColor: storybookTheme.color.pillBackground },
  statusLabel: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
  },
  statusLabelOn: { color: storybookTheme.color.background },
  statusLabelOff: { color: storybookTheme.color.onCardMuted },
  detail: {
    fontSize: storybookTheme.type.xs,
    lineHeight: storybookTheme.type.xs * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onCardMuted,
  },
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
