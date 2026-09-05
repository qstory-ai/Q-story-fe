import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { AppNavShell, ErrorState, LoadingState, StatusBanner, SwitchField, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { dashboardNavItems, useAuth } from '@/entities/auth';
import {
  getNotificationSettings,
  updateNotificationSettings,
  type NotificationSettings,
} from '@/entities/notification-settings';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; settings: NotificationSettings }
  | { status: 'error'; message: string };

/**
 * IA "[4] 마이페이지 > 알림 설정" 화면. 지금은 마케팅 알림(새 작품 출시) 토글 하나로 시작해서
 * IA에서 "#### 생각해와라"로 표시된 나머지 항목은 결정되면 여기 추가한다. 각 스위치는 상태를
 * BE에 즉시 PATCH로 보내는 낙관적 UI - 저장 버튼 없이 토글이 곧 저장이다.
 */
export function MyPageNotificationsPage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [savingKey, setSavingKey] = useState<keyof NotificationSettings | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'PARENT') {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  useEffect(() => {
    if (state.status !== 'authenticated') return;
    let cancelled = false;
    getNotificationSettings(state.token)
      .then((settings) => {
        if (!cancelled) setLoad({ status: 'ready', settings });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = messageForError(error, '알림 설정을 불러오지 못했어요.');
        setLoad({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [state, reloadKey]);

  async function toggle(key: keyof NotificationSettings, next: boolean) {
    if (state.status !== 'authenticated' || load.status !== 'ready') return;
    setSavingKey(key);
    setSaveError(null);
    // 낙관적 업데이트 - 실패 시 롤백한다.
    const previous = load.settings;
    setLoad({ status: 'ready', settings: { ...previous, [key]: next } });
    try {
      const updated = await updateNotificationSettings(state.token, { [key]: next });
      setLoad({ status: 'ready', settings: updated });
    } catch (error: unknown) {
      setLoad({ status: 'ready', settings: previous });
      const message = messageForError(error, '설정을 저장하지 못했어요.');
      setSaveError(message);
    } finally {
      setSavingKey(null);
    }
  }

  if (state.status !== 'authenticated') return null;

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, 'mypage')} onBack={() => navigate('/mypage')}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">알림 설정</Text>

        {load.status === 'loading' ? (
          <LoadingState label="알림 설정을 불러오는 중이에요…" />
        ) : load.status === 'error' ? (
          <ErrorState message={load.message} onRetry={() => setReloadKey((n) => n + 1)} />
        ) : (
          <View style={styles.card}>
            <SwitchField
              label="새 작품 출시 알림"
              description="새 이야기가 서재에 올라올 때 이메일과 앱 알림으로 알려드려요."
              checked={load.settings.marketingEnabled}
              onChange={(next) => toggle('marketingEnabled', next)}
              disabled={savingKey === 'marketingEnabled'}
            />
          </View>
        )}

        {saveError ? <StatusBanner variant="warning" label={saveError} /> : null}
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
  title: {
    fontSize: storybookTheme.type.xl,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onContent,
  },
  card: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.contentSurface,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentSurfaceBorder,
    padding: storybookTheme.spacing.ml,
    gap: storybookTheme.spacing.ms,
  },
});
