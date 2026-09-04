import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { AppNavShell, Pill, SectionHeader, StatusBanner, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, useAuth, type UserSummary } from '@/entities/auth';

const STATUS_LABEL: Record<UserSummary['subscriptionStatus'], string> = {
  NONE: '구독 없음',
  TRIALING: '체험 중',
  ACTIVE: '구독 중',
  EXPIRED: '만료됨',
};

/** 결제 연동 전까지 준비 중으로 표시할 하위 항목 - 실제 카드/결제일 데이터가 없다. */
const UPCOMING_ROWS = ['다음 구독 정보', '결제 수단 관리', '결제 내역'];

/** 구독 관리 - 결제 연동 전이라 현재 상태만 실데이터로 보여주고, 나머지 항목은 준비 중으로 표시한다(사용자 확정 범위). */
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
        <SectionHeader title="나의구독" />
        <View style={styles.card}>
          <Pill label={STATUS_LABEL[user.subscriptionStatus]} />
          <StatusBanner
            label={user.grantsAccess ? '지금 전체 이야기를 이용할 수 있어요.' : '지금은 전체 이야기를 이용할 수 없어요.'}
            variant={user.grantsAccess ? 'info' : 'warning'}
          />
        </View>

        <View style={styles.menuCard}>
          {UPCOMING_ROWS.map((label) => (
            <View key={label} style={styles.menuRow}>
              <Text style={styles.menuLabel}>{label}</Text>
              <Pill label="준비 중" />
            </View>
          ))}
        </View>
        <Text style={styles.note}>결제/구독 연동은 아직 준비 중이에요. 진행 상황은 추후 안내드릴게요.</Text>
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
  menuCard: {
    width: '100%',
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    paddingHorizontal: storybookTheme.spacing.ml,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.pillBorder,
  },
  menuLabel: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.semibold,
    color: storybookTheme.color.onCardMuted,
  },
  note: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.regular,
    color: storybookTheme.color.onDarkMuted,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
  },
});
