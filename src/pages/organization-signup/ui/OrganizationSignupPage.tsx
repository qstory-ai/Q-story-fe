import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, AppNavShell, SafeAreaView, StatusBanner, TextField, storybookTheme } from '@/shared/ui';
import {
  AuthApiError,
  createClass,
  createClassInvite,
  createOrganization,
  dashboardNavItems,
  fetchEntitlement,
  listClasses,
  useAuth,
  type ClassResponse,
  type EntitlementResponse,
  type UserSummary,
} from '@/entities/auth';

const SUBSCRIPTION_LABEL: Record<EntitlementResponse['subscriptionStatus'], string> = {
  NONE: '구독 전',
  TRIALING: '체험판 이용 중',
  ACTIVE: '구독 중',
  EXPIRED: '구독이 만료됐어요',
};

/**
 * 인증 상태에 따라 구동되는 두 단계(organization -> classes)임 - 두 개의 라우트가 아닌 이유는,
 * 원장은 항상 이 고정된 순서로 진행하며 한 단계를 지나면 이전 단계로 돌아갈 필요가 없기 때문.
 * 가입 자체는 이제 통합된 /signup 화면에 있으며, 여기서 인증되지 않은 방문자는 그곳으로
 * 리다이렉트된다.
 *
 * 두 단계 모두 DIRECTOR의 실제 홈("/organization")이라 PARENT/CLASS_ACCOUNT/TUTOR 홈과 같은
 * AppNavShell을 쓴다 - 예전엔 AccountLinkRow + 라이트 셸을 혼자 쓰고 있어서 역할 홈마다
 * 헤더가 다르게 보였다.
 */
export function OrganizationSignupPage() {
  const { state } = useAuth();

  if (state.status === 'loading') {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <View style={styles.centered}>
          <ActivityIndicator color={storybookTheme.color.gold} />
        </View>
      </SafeAreaView>
    );
  }
  if (state.status === 'authenticated' && state.user.role === 'DIRECTOR') {
    return state.user.organizationId ? (
      <ClassManagementStep token={state.token} organizationId={state.user.organizationId} user={state.user} />
    ) : (
      <CreateOrganizationStep token={state.token} user={state.user} />
    );
  }
  if (state.status === 'authenticated') {
    return <Redirect to="/" />;
  }
  return <Redirect to="/signup?role=organization" />;
}

function Redirect({ to }: { to: string }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace: true });
  }, [navigate, to]);
  return null;
}

function CreateOrganizationStep({ token, user }: { token: string; user: UserSummary }) {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      const response = await createOrganization(token, { name: name.trim() });
      setSession(response.token, response.user);
    } catch (failure) {
      setError(failure instanceof AuthApiError ? failure.message : '기관 및 단체를 등록하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }, [token, name, setSession]);

  return (
    <AppNavShell items={dashboardNavItems(user, navigate, 'home')}>
      <View style={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.title} accessibilityRole="header">기관 및 단체 등록</Text>
          <Text style={styles.body}>거의 다 됐어요. 기관 및 단체 이름을 알려주세요.</Text>
          <TextField label="기관 및 단체 이름" value={name} onChangeText={setName} errorText={error ?? undefined} />
          <ActionButton
            label="등록하기"
            loading={submitting}
            onPress={onSubmit}
            disabled={!name.trim()}
          />
        </View>
      </View>
    </AppNavShell>
  );
}

function ClassManagementStep({
  token,
  organizationId,
  user,
}: {
  token: string;
  organizationId: string;
  user: UserSummary;
}) {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassResponse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [initialPassword, setInitialPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [inviteByClassId, setInviteByClassId] = useState<Record<string, string>>({});
  const [entitlement, setEntitlement] = useState<EntitlementResponse | null>(null);

  const reload = useCallback(() => {
    listClasses(token, organizationId)
      .then(setClasses)
      .catch((failure) =>
        setLoadError(failure instanceof AuthApiError ? failure.message : '반 목록을 불러오지 못했어요.'),
      );
  }, [token, organizationId]);

  useEffect(reload, [reload]);

  useEffect(() => {
    let cancelled = false;
    fetchEntitlement(token, organizationId)
      .then((response) => {
        if (!cancelled) setEntitlement(response);
      })
      .catch(() => {
        // 구독 상태는 부가 정보라 조회 실패해도 반 관리 자체는 그대로 쓸 수 있어야 한다.
      });
    return () => {
      cancelled = true;
    };
  }, [token, organizationId]);

  const onCreateClass = useCallback(async () => {
    setFormError(null);
    setSubmitting(true);
    try {
      await createClass(token, organizationId, { name: name.trim(), initialPassword });
      setName('');
      setInitialPassword('');
      reload();
    } catch (failure) {
      setFormError(failure instanceof AuthApiError ? failure.message : '반을 만들지 못했어요. 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }, [token, organizationId, name, initialPassword, reload]);

  const onCreateInvite = useCallback(
    async (classId: string) => {
      try {
        const invite = await createClassInvite(token, classId);
        const shareUrl = `${globalThis.location?.origin ?? ''}/signup?invite=${invite.token}`;
        setInviteByClassId((prev) => ({ ...prev, [classId]: shareUrl }));
      } catch {
        // 초대 링크 생성 실패는 그 반 카드에만 조용히 남겨둔다 - 다시 누르면 재시도된다.
      }
    },
    [token],
  );

  return (
    <AppNavShell items={dashboardNavItems(user, navigate, 'home')}>
      <View style={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.title} accessibilityRole="header">반 관리</Text>

          {/*
            entitlement.grantsAccess=false는 requiresEntitlement=true인 작품만 막는다
            (EntitlementService.assertAccessible) - 지금 카탈로그의 유일한 작품(HG)은
            requiresEntitlement=false라서 구독 여부와 무관하게 무료 데모로 계속 열려 있다.
            "이야기를 아예 시작할 수 없다"는 예전 문구는 사실이 아니었다 - 구독은 데모 이후의
            전체 작품에만 걸리는 것이라고 정확히 말해야 한다.
          */}
          {entitlement && (
            <StatusBanner
              variant={entitlement.grantsAccess ? 'info' : 'warning'}
              label={SUBSCRIPTION_LABEL[entitlement.subscriptionStatus]}
              body={
                entitlement.grantsAccess
                  ? undefined
                  : '구독 없이도 무료 데모 한 편은 계속 이용할 수 있어요. 전체 이야기는 구독 후 열려요.'
              }
            />
          )}

          <View style={styles.subCard}>
            <Text style={styles.cardTitle}>새 반 만들기</Text>
            <TextField label="반 이름" value={name} onChangeText={setName} />
            <TextField
              label="반 계정 초기 비밀번호"
              value={initialPassword}
              onChangeText={setInitialPassword}
              secureTextEntry
              errorText={formError ?? undefined}
            />
            <ActionButton
              label="반 만들기"
              loading={submitting}
              onPress={onCreateClass}
              disabled={!name.trim() || !initialPassword}
            />
          </View>

          <View style={styles.subCard}>
            <Text style={styles.cardTitle}>선생님 관리</Text>
            <Text style={styles.panelBody}>
              소속 선생님을 초대하고 관리해요. 초대 코드나 링크를 전달하면 선생님이 소속을 수락할 수 있어요.
            </Text>
            <ActionButton
              variant="secondaryFull"
              label="선생님 관리 열기"
              onPress={() => navigate('/organization/tutors')}
            />
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>등록된 반</Text>
          {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}
          {classes?.length === 0 ? <Text style={styles.panelBody}>아직 등록된 반이 없어요.</Text> : null}
          {classes?.map((classGroup) => (
            <View key={classGroup.id} style={styles.classRow}>
              <Text style={styles.storyTitle}>{classGroup.name}</Text>
              <Text style={styles.storyMeta}>반 코드: {classGroup.joinCode}</Text>
              <ActionButton
                variant="secondaryFull"
                label="1회용 초대 링크 만들기"
                onPress={() => onCreateInvite(classGroup.id)}
              />
              {inviteByClassId[classGroup.id] ? (
                <Text selectable style={styles.inviteUrl}>
                  {inviteByClassId[classGroup.id]}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      </View>
    </AppNavShell>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: storybookTheme.color.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: {
    flex: 1,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  card: {
    width: '100%',
    alignItems: 'stretch',
    backgroundColor: storybookTheme.color.surfaceCard,
    borderRadius: storybookTheme.radius.card,
    paddingHorizontal: 24,
    paddingVertical: 28,
    gap: 14,
  },
  subCard: {
    gap: 10,
    marginTop: 4,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.pillBorder,
  },
  title: { fontSize: storybookTheme.type.lg, fontWeight: '900', color: storybookTheme.color.onCardTitle },
  body: { fontSize: storybookTheme.type.sm, lineHeight: 21, color: storybookTheme.color.onCardBody },
  cardTitle: { fontSize: storybookTheme.type.md, fontWeight: '700', color: storybookTheme.color.onCardTitle },
  errorText: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.error },
  panel: {
    width: '100%',
    gap: 4,
    backgroundColor: storybookTheme.color.panelOnDarkBackground,
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    borderColor: storybookTheme.color.panelOnDarkBorder,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  panelTitle: { fontSize: storybookTheme.type.md, fontWeight: '900', color: storybookTheme.color.onDark, marginBottom: 6 },
  panelBody: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onDarkMuted },
  classRow: {
    gap: 8,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.panelOnDarkBorder,
  },
  storyTitle: { fontSize: storybookTheme.type.sm, fontWeight: '700', color: storybookTheme.color.onDark },
  storyMeta: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onDarkMuted },
  inviteUrl: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.linkOnDark },
});
