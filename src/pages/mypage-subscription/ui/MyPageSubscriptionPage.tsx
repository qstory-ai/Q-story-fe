import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { AppNavShell, Pill, StatusBanner, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, useAuth, type UserSummary } from '@/entities/auth';

const STATUS_LABEL: Record<UserSummary['subscriptionStatus'], string> = {
  NONE: '구독 없음',
  TRIALING: '체험 중',
  ACTIVE: '구독 중',
  EXPIRED: '만료됨',
};

/** 구독 관리 - 결제 연동 전이라 현재 상태만 보여준다(사용자 확정 범위). */
export function MyPageSubscriptionPage() {
  const navigate = useNavigate();
  const { state } = useAuth();

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated') {
      navigate('/', { replace: true });
    }
  }, [state.status, navigate]);

  if (state.status !== 'authenticated') return null;
  const { user } = state;

  return (
    <AppNavShell items={dashboardNavItems(user, navigate, 'mypage')} onBack={() => navigate('/mypage')}>
      <View style={styles.content}>
        <View style={styles.card}>
          <Pill label={STATUS_LABEL[user.subscriptionStatus]} />
          <StatusBanner
            label={user.grantsAccess ? '지금 전체 이야기를 이용할 수 있어요.' : '지금은 전체 이야기를 이용할 수 없어요.'}
            variant={user.grantsAccess ? 'info' : 'warning'}
          />
          <Text style={styles.note}>결제/구독 연동은 아직 준비 중이에요. 진행 상황은 추후 안내드릴게요.</Text>
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
  note: {
    fontSize: storybookTheme.type.sm,
    fontWeight: '400',
    color: storybookTheme.color.onCardMuted,
    lineHeight: 20,
  },
});
