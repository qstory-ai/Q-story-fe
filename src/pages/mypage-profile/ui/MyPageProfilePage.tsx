import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, AppNavShell, StatusBanner, TextField, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, updateProfile, useAuth, type UserSummary } from '@/entities/auth';
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
  const isParent = user.role === 'PARENT';

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

  return (
    <AppNavShell items={dashboardNavItems(user, navigate, 'mypage')} onBack={() => navigate('/mypage')}>
      <View style={styles.content}>
        <View style={styles.card}>
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 16,
  },
  card: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    padding: 24,
    gap: 16,
    ...storybookTheme.elevation.high,
  },
});
