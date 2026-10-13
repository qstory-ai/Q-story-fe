import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  acknowledgeOrganizationGuardianConsent,
  CONSENT_VERSION,
  fetchCurrentUser,
  pendingConsentsOf,
  recordConsents,
  useAuth,
  type PendingConsent,
  type UserSummary,
} from '@/entities/auth';
import { GuardianConsent, OrgGuardianAck, OverseasTransferConsent } from '@/features/terms-consent';
import { messageForError } from '@/shared/api';
import { ActionButton, SafeAreaView, StatusBanner, storybookTheme } from '@/shared/ui';

/** 동의하지 않는 사람도 갈 수 있어야 하는 화면 - 탈퇴(동의 거부)와 비밀번호 재설정. */
const PASSTHROUGH_PATHS = ['/mypage/delete-account', '/reset-password'];

/**
 * 약관 2026-10-v2 이전에 가입한 계정이 로그인하면, 새 필수 동의(법정대리인 확인·국외 이전·기관 보호자 동의 확인)를
 * 받기 전까지 다른 화면 대신 다시 동의 화면을 보여 준다. 서버가 UserSummary.pendingConsents로 알려 준다 - STAFF와
 * 예전 서버(값 없음)는 그대로 지나간다.
 */
export function ReconsentGate({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const { pathname } = useLocation();
  if (state.status !== 'authenticated') return <>{children}</>;
  const pending = pendingConsentsOf(state.user);
  if (pending.length === 0 || PASSTHROUGH_PATHS.includes(pathname)) return <>{children}</>;
  return <ReconsentScreen token={state.token} user={state.user} pending={pending} />;
}

function ReconsentScreen({ token, user, pending }: { token: string; user: UserSummary; pending: PendingConsent[] }) {
  const navigate = useNavigate();
  const { updateUser, logout } = useAuth();
  const [checked, setChecked] = useState<Record<PendingConsent, boolean>>({
    GUARDIAN: false,
    OVERSEAS_TRANSFER: false,
    ORG_GUARDIAN_ACK: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allChecked = pending.every((item) => checked[item]);
  const toggle = (item: PendingConsent) => (next: boolean) => setChecked((prev) => ({ ...prev, [item]: next }));

  async function submit() {
    if (!allChecked || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const items = pending
        .filter((item): item is 'GUARDIAN' | 'OVERSEAS_TRANSFER' => item !== 'ORG_GUARDIAN_ACK')
        .map((type) => ({ type, agreed: true, version: CONSENT_VERSION }));
      if (items.length > 0) await recordConsents(token, { source: 'RECONSENT', items });
      if (pending.includes('ORG_GUARDIAN_ACK') && user.organizationId) {
        await acknowledgeOrganizationGuardianConsent(token, user.organizationId, { consentVersion: CONSENT_VERSION });
      }
      updateUser(await fetchCurrentUser(token));
    } catch (failure) {
      setError(messageForError(failure, '동의 내용을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.eyebrow}>개인정보 처리방침 변경</Text>
        <Text style={styles.title} accessibilityRole="header">
          새 동의 항목을 확인해 주세요
        </Text>
        <Text style={styles.lead}>
          아이 정보 보호 절차를 보강하면서 아래 항목에 동의가 필요해졌어요. 동의하면 지금까지처럼 이용할 수 있어요.
        </Text>
        <View style={styles.card}>
          {pending.includes('GUARDIAN') ? (
            <GuardianConsent checked={checked.GUARDIAN} onChange={toggle('GUARDIAN')} />
          ) : null}
          {pending.includes('OVERSEAS_TRANSFER') ? (
            <OverseasTransferConsent checked={checked.OVERSEAS_TRANSFER} onChange={toggle('OVERSEAS_TRANSFER')} />
          ) : null}
          {pending.includes('ORG_GUARDIAN_ACK') ? (
            <OrgGuardianAck checked={checked.ORG_GUARDIAN_ACK} onChange={toggle('ORG_GUARDIAN_ACK')} />
          ) : null}
        </View>
        {error ? <StatusBanner variant="warning" label={error} /> : null}
        <ActionButton
          variant="gold"
          label={submitting ? '저장 중…' : '동의하고 계속하기'}
          onPress={submit}
          disabled={!allChecked || submitting}
        />
        <Text style={styles.note}>
          동의하지 않으면 서비스를 이용할 수 없어요. 원하지 않으면 로그아웃하거나 회원 탈퇴할 수 있어요.
        </Text>
        <View style={styles.linkRow}>
          <Pressable accessibilityRole="button" hitSlop={6} onPress={logout}>
            <Text style={styles.link}>로그아웃</Text>
          </Pressable>
          <Pressable accessibilityRole="link" hitSlop={6} onPress={() => navigate('/mypage/delete-account')}>
            <Text style={styles.link}>회원 탈퇴</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: storybookTheme.color.background },
  body: {
    flexGrow: 1,
    width: '100%',
    maxWidth: storybookTheme.layout.contentMaxWidth,
    alignSelf: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  eyebrow: {
    color: storybookTheme.color.primary,
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.semibold,
  },
  title: {
    color: storybookTheme.color.onContent,
    fontSize: storybookTheme.type.lg,
    fontWeight: storybookTheme.type.weight.bold,
  },
  lead: {
    color: storybookTheme.color.onContentMuted,
    fontSize: storybookTheme.type.sm,
    lineHeight: 21,
  },
  card: {
    gap: 10,
    padding: 14,
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    borderColor: storybookTheme.color.lightCardBorder,
    backgroundColor: storybookTheme.color.surfaceWhite,
  },
  note: { color: storybookTheme.color.onContentMuted, fontSize: storybookTheme.type.xs, lineHeight: 18 },
  linkRow: { flexDirection: 'row', gap: 20, justifyContent: 'center' },
  link: {
    color: storybookTheme.color.linkOnLight,
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    textDecorationLine: 'underline',
    minHeight: 44,
    textAlignVertical: 'center',
    paddingVertical: 12,
  },
});
