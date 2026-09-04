import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, AppNavShell, Pill, SectionHeader, StatusBanner, TextField, storybookTheme } from '@/shared/ui';
import { changePassword, dashboardNavItems, useAuth, type Role } from '@/entities/auth';
import { messageForError } from '@/shared/api';

const ROLE_LABEL: Record<Role, string> = {
  DIRECTOR: '기관 및 단체',
  CLASS_ACCOUNT: '반 계정',
  PARENT: '학부모',
  TUTOR: '선생님',
  STAFF: '콘텐츠 운영자',
};

/** 계정 관리 - 아이디 표시 + 로그인된 상태에서 현재 비밀번호로 바로 바꾸는 폼. */
export function MyPageAccountPage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated') {
      navigate('/', { replace: true });
    }
  }, [state.status, navigate]);

  if (state.status !== 'authenticated') return null;
  const { user, token } = state;

  // BE AuthValidator.validatePassword와 같은 규칙(8자 이상)을 client에서 먼저 잡아 서버 왕복 없이
  // 즉시 피드백. 필드별로 inline 에러가 붙고, canSubmit이 만족되지 않으면 버튼은 disabled.
  const passwordTooShort = newPassword.length > 0 && newPassword.length < 8;
  const confirmMismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;
  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    confirmPassword === newPassword &&
    !saving;

  async function handleChangePassword() {
    // 방어적 재검증 - 버튼이 disabled여도 (예: 엔터키·접근성 tool로) 호출될 수 있으니.
    if (!canSubmit) return;
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await changePassword(token, { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSaved(true);
    } catch (err) {
      setError(messageForError(err, '비밀번호를 바꾸지 못했어요. 현재 비밀번호가 맞는지 확인해 주세요.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppNavShell items={dashboardNavItems(user, navigate, 'mypage')} onBack={() => navigate('/mypage')}>
      <View style={styles.content}>
        <SectionHeader title="계정정보" />
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>아이디</Text>
            <Text style={styles.infoValue}>{user.loginId}</Text>
          </View>
          {user.email ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>이메일</Text>
              <Text style={styles.infoValue}>{user.email}</Text>
            </View>
          ) : null}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>이름</Text>
            <Text style={styles.infoValue}>{user.displayName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>회원 구분</Text>
            <Pill label={ROLE_LABEL[user.role]} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>비밀번호 변경</Text>
          <TextField
            label="현재 비밀번호"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
          />
          <TextField
            label="새 비밀번호"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            description="8자 이상"
            errorText={passwordTooShort ? '비밀번호는 8자 이상이어야 해요.' : undefined}
          />
          <TextField
            label="새 비밀번호 확인"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            errorText={confirmMismatch ? '새 비밀번호가 서로 달라요.' : undefined}
          />
          {saved ? <StatusBanner label="비밀번호를 변경했어요." /> : null}
          {error ? <StatusBanner variant="warning" label={error} /> : null}
          <ActionButton label="비밀번호 변경" onPress={handleChangePassword} loading={saving} disabled={!canSubmit} />
        </View>

        <Pressable
          onPress={() => navigate('/mypage/delete-account')}
          accessibilityRole="link"
          hitSlop={8}
          style={styles.deleteAccountLink}
        >
          <Text style={styles.deleteAccountText}>회원 탈퇴</Text>
        </Pressable>
      </View>
    </AppNavShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    width: '100%',
    maxWidth: storybookTheme.layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: storybookTheme.spacing.ml,
    paddingTop: storybookTheme.spacing.lg,
    paddingBottom: storybookTheme.spacing.xl,
    gap: storybookTheme.spacing.md,
  },
  card: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    padding: storybookTheme.spacing.lg,
    gap: storybookTheme.spacing.md,
    ...storybookTheme.elevation.high,
  },
  sectionTitle: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
  },
  infoLabel: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.regular,
    color: storybookTheme.color.onCardMuted,
  },
  infoValue: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.medium,
    color: storybookTheme.color.onCardBody,
  },
  deleteAccountLink: {
    alignSelf: 'center',
    minHeight: 40,
    justifyContent: 'center',
  },
  deleteAccountText: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.medium,
    color: storybookTheme.color.onDarkMuted,
    textDecorationLine: 'underline',
  },
});
