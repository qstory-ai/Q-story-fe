import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useNavigate, useLocation } from 'react-router-dom';

import { ActionButton, AppNavShell, Pill, StatusBanner, TextField, storybookTheme } from '@/shared/ui';
import {
  changePassword,
  dashboardNavItems,
  isPasswordLongEnough,
  PASSWORD_RULE_HINT,
  PASSWORD_TOO_SHORT_MESSAGE,
  roleLabel,
  updateProfile,
  uploadProfileImage,
  useAuth,
  type UserSummary,
} from '@/entities/auth';
import { messageForError } from '@/shared/api';

/**
 * 내 정보·계정(UX 정리 4번) - 예전 "내 정보 관리"(/mypage/profile, 이제 여기로 넘어온다)와 "계정 관리"를
 * 한 화면에 둔다. 프로필(선생님 사진, 이름, 보호자의 아이 이름) → 로그인 정보(아이디·이메일·회원 구분) →
 * 비밀번호 변경 순서. 각 카드는 따로 저장된다.
 */
export function MyPageAccountPage() {
  const navigate = useNavigate();
  const { state } = useAuth();

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated') {
      navigate('/', { replace: true });
    }
  }, [state.status, navigate]);

  if (state.status !== 'authenticated') return null;

  // user.id로 key를 줘서, 인증 상태가 막 정착된 뒤에도 폼 내부 state는 항상 이 사용자의 값으로
  // "마운트 시점에" 초기화된다 - useEffect로 나중에 setState하는 대신(react-hooks/set-state-in-effect
  // 참고, StoryDetailPage.tsx의 같은 관례).
  return <AccountScreen key={state.user.id} user={state.user} token={state.token} navigate={navigate} />;
}

function AccountScreen({
  user,
  token,
  navigate,
}: {
  user: UserSummary;
  token: string;
  navigate: (path: string) => void;
}) {
  const { pathname } = useLocation();
  const { updateUser } = useAuth();
  // 프로필 - displayName은 모든 역할, 아이 이름은 PARENT만, 프로필 사진은 TUTOR만 편집한다.
  const [displayName, setDisplayName] = useState(user.displayName);
  const [childName, setChildName] = useState(user.childName ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isParent = user.role === 'PARENT';
  const isTutor = user.role === 'TUTOR';
  // 비밀번호 변경
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateProfile(token, {
        displayName,
        childName: isParent ? childName : undefined,
      });
      updateUser(updated);
      setSaved(true);
    } catch (err) {
      setError(messageForError(err, '프로필 저장에 실패했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleImage(file: File) {
    setImageError(null);
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setImageError('JPG 또는 PNG 이미지를 선택해 주세요.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setImageError('프로필 이미지는 4MB 이하만 올릴 수 있어요.');
      return;
    }
    setUploadingImage(true);
    try {
      updateUser(await uploadProfileImage(token, file));
    } catch (err) {
      setImageError(messageForError(err, '프로필 이미지를 올리지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setUploadingImage(false);
    }
  }

  // BE AuthValidator.validatePassword와 같은 규칙(8자 이상)을 client에서 먼저 잡아 서버 왕복 없이
  // 즉시 피드백. 필드별로 inline 에러가 붙고, canSubmit이 만족되지 않으면 버튼은 disabled.
  const passwordTooShort = newPassword.length > 0 && !isPasswordLongEnough(newPassword);
  const confirmMismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;
  const canSubmit =
    currentPassword.length > 0 &&
    isPasswordLongEnough(newPassword) &&
    confirmPassword === newPassword &&
    !passwordSaving;

  async function handleChangePassword() {
    // 방어적 재검증 - 버튼이 disabled여도 (예: 엔터키·접근성 tool로) 호출될 수 있으니.
    if (!canSubmit) return;
    setPasswordError(null);
    setPasswordSaved(false);
    setPasswordSaving(true);
    try {
      await changePassword(token, { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSaved(true);
    } catch (err) {
      setPasswordError(messageForError(err, '비밀번호를 바꾸지 못했어요. 현재 비밀번호가 맞는지 확인해 주세요.'));
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <AppNavShell items={dashboardNavItems(user, navigate, pathname)} onBack={() => navigate('/mypage')}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">내 정보·계정</Text>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>프로필</Text>
          {isTutor ? (
            <View style={styles.photoSection}>
              <Text style={styles.photoLabel}>프로필 이미지</Text>
              <View style={styles.photoRow}>
                {user.profileImageUrl ? (
                  <Image source={{ uri: user.profileImageUrl }} style={styles.photo} accessibilityLabel="선생님 프로필 이미지" />
                ) : (
                  <View style={styles.photoPlaceholder}><Text style={styles.photoPlaceholderText}>선생님</Text></View>
                )}
                <ActionButton
                  label={user.profileImageUrl ? '이미지 변경' : '이미지 올리기'}
                  variant="secondary"
                  onPress={() => fileInputRef.current?.click()}
                  loading={uploadingImage}
                  disabled={uploadingImage}
                />
              </View>
              <Text style={styles.photoHint}>JPG 또는 PNG · 최대 4MB · 2048px 이하</Text>
              {imageError ? <StatusBanner variant="warning" label={imageError} /> : null}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                style={{ display: 'none' }}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = '';
                  if (file) void handleImage(file);
                }}
              />
            </View>
          ) : null}
          <TextField label="이름" value={displayName} onChangeText={setDisplayName} />
          {isParent ? (
            <TextField
              label="아이 이름"
              value={childName}
              onChangeText={setChildName}
              placeholder="아이 이름이나 별칭"
            />
          ) : null}
          {saved ? <StatusBanner label="저장했어요." /> : null}
          {error ? <StatusBanner variant="warning" label={error} /> : null}
          <ActionButton label="프로필 저장" onPress={handleSave} loading={saving} />
        </View>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>로그인 정보</Text>
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
            <Text style={styles.infoLabel}>회원 구분</Text>
            <Pill label={roleLabel(user.role)} />
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
            description={PASSWORD_RULE_HINT}
            errorText={passwordTooShort ? PASSWORD_TOO_SHORT_MESSAGE : undefined}
          />
          <TextField
            label="새 비밀번호 확인"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            errorText={confirmMismatch ? '새 비밀번호가 서로 달라요.' : undefined}
          />
          {passwordSaved ? <StatusBanner label="비밀번호를 변경했어요." /> : null}
          {passwordError ? <StatusBanner variant="warning" label={passwordError} /> : null}
          <ActionButton label="비밀번호 변경" onPress={handleChangePassword} loading={passwordSaving} disabled={!canSubmit} />
        </View>
      </View>
    </AppNavShell>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: storybookTheme.type.xl, fontWeight: storybookTheme.type.weight.black, color: storybookTheme.color.onContent },
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
  photoSection: { gap: storybookTheme.spacing.xs },
  photoLabel: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: storybookTheme.spacing.md },
  photo: { width: 64, height: 64, borderRadius: 32, backgroundColor: storybookTheme.color.pillBorder },
  photoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: storybookTheme.color.pillBorder,
  },
  photoPlaceholderText: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onCardMuted },
  photoHint: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onCardMuted },
});
