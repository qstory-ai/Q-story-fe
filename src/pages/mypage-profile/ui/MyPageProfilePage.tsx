import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, AppNavShell, StatusBanner, TextField, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, updateProfile, uploadProfileImage, useAuth, type UserSummary } from '@/entities/auth';
import { messageForError } from '@/shared/api';

export function MyPageProfilePage() {
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
  return <ProfileForm key={state.user.id} user={state.user} token={state.token} navigate={navigate} />;
}

/** 내 정보 관리 폼 - displayName은 모든 역할, 자녀 이름은 PARENT만 편집한다(요청사항). */
function ProfileForm({
  user,
  token,
  navigate,
}: {
  user: UserSummary;
  token: string;
  navigate: (path: string) => void;
}) {
  const { updateUser } = useAuth();
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

  return (
    <AppNavShell items={dashboardNavItems(user, navigate, 'mypage')} onBack={() => navigate('/mypage')}>
      <View style={styles.content}>
        <View style={styles.card}>
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
              placeholder="이야기 속에서 아이를 부를 이름이에요"
            />
          ) : null}
          {saved ? <StatusBanner label="저장했어요." /> : null}
          {error ? <StatusBanner variant="warning" label={error} /> : null}
          <ActionButton label="저장" onPress={handleSave} loading={saving} />
        </View>
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
