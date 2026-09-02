import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { AppNavShell, StatusBanner, storybookTheme } from '@/shared/ui';
import {
  AuthApiError,
  dashboardNavItems,
  fetchEntitlement,
  useAuth,
  type EntitlementResponse,
} from '@/entities/auth';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; entitlement: EntitlementResponse }
  | { status: 'error'; message: string };

const SUBSCRIPTION_LABEL: Record<EntitlementResponse['subscriptionStatus'], string> = {
  NONE: '구독 전',
  TRIALING: '체험판 이용 중',
  ACTIVE: '구독 중',
  EXPIRED: '구독이 만료됐어요',
};

const SUBSCRIPTION_BODY: Record<EntitlementResponse['subscriptionStatus'], string> = {
  NONE: '아직 정식 구독이 시작되지 않았어요. 무료 데모 한 편은 계속 이용할 수 있어요.',
  TRIALING: '체험판 기간 동안 전체 이야기가 열려 있어요. 종료 전에 결제 문의를 남겨 주세요.',
  ACTIVE: '기관 구독으로 전체 이야기가 열려 있어요.',
  EXPIRED: '구독이 만료돼서 전체 이야기 접근이 다시 잠겼어요. 갱신 문의를 남겨 주세요.',
};

const CONTACT_EMAIL = 'partners@qstory.co.kr';

async function openContactMail() {
  const href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('[Q-Story] 기관 구독 문의')}`;
  try {
    await Linking.openURL(href);
  } catch {
    if (typeof window !== 'undefined') window.alert?.(`문의 메일: ${CONTACT_EMAIL}`);
  }
}

/**
 * IA "기관 관리자 > 결제/라이선스 관리". 결제 백엔드가 아직 없어 이 화면은 현재 이용권 상태
 * (fetchEntitlement)만 표시하고, 실제 갱신·결제는 문의 메일로 안내한다. 지표는 EntitlementService가
 * organization.subscriptionStatus 하나만 보고 판단하므로 여기서도 그 상태를 그대로 노출한다.
 */
export function OrganizationSubscriptionPage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });

  const canView = state.status === 'authenticated' && state.user.role === 'DIRECTOR' && Boolean(state.user.organizationId);
  const organizationId = state.status === 'authenticated' ? state.user.organizationId : null;

  useEffect(() => {
    if (state.status === 'loading') return;
    if (!canView) {
      navigate('/', { replace: true });
    }
  }, [state.status, canView, navigate]);

  useEffect(() => {
    if (state.status !== 'authenticated' || !organizationId) return;
    let cancelled = false;
    fetchEntitlement(state.token, organizationId)
      .then((entitlement) => {
        if (!cancelled) setLoad({ status: 'ready', entitlement });
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        const message = failure instanceof AuthApiError ? failure.message : '이용권 정보를 불러오지 못했어요.';
        setLoad({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [state, organizationId]);

  if (!canView) return null;

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, 'home')} onBack={() => navigate('/organization')}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">이용권 · 라이선스</Text>
        <Text style={styles.subtitle}>기관 구독 상태와 활성 이용 범위를 확인해요.</Text>

        {load.status === 'loading' && (
          <View style={styles.centerBox}><ActivityIndicator color={storybookTheme.color.gold} /></View>
        )}

        {load.status === 'error' && (
          <StatusBanner variant="warning" label={load.message} />
        )}

        {load.status === 'ready' && (
          <>
            <View style={styles.card}>
              <Text style={styles.statusEyebrow}>현재 상태</Text>
              <Text style={styles.statusHeading}>{SUBSCRIPTION_LABEL[load.entitlement.subscriptionStatus]}</Text>
              <Text style={styles.body}>{SUBSCRIPTION_BODY[load.entitlement.subscriptionStatus]}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>이야기 접근</Text>
                <Text style={styles.metaValue}>
                  {load.entitlement.grantsAccess ? '전체 이야기 열림' : '무료 데모만 이용 가능'}
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>결제·갱신 문의</Text>
              <Text style={styles.body}>
                결제/갱신은 준비 중이에요. 지금은 아래 메일로 문의해 주시면 담당자가 안내드립니다.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="결제 문의 메일 보내기"
                onPress={openContactMail}
                style={({ pressed }) => [styles.mailButton, pressed && styles.mailButtonPressed]}
              >
                <Text style={styles.mailButtonLabel}>{CONTACT_EMAIL}로 메일 보내기</Text>
              </Pressable>
            </View>
          </>
        )}
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
    gap: 14,
  },
  title: {
    fontSize: storybookTheme.type.xl,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onDark,
  },
  subtitle: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onDarkMuted },
  centerBox: { alignItems: 'center', paddingVertical: 40 },
  card: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    padding: 20,
    gap: 10,
  },
  statusEyebrow: {
    fontSize: storybookTheme.type.xxs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.gold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  statusHeading: {
    fontSize: storybookTheme.type.lg,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onCardTitle,
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
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.pillBorder,
  },
  metaLabel: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onCardMuted },
  metaValue: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardBody,
  },
  mailButton: {
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.primary,
    alignItems: 'center',
  },
  mailButtonPressed: { opacity: 0.85 },
  mailButtonLabel: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onDark,
  },
});
