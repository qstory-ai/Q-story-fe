import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { AccountLinkRow, ActionButton, SafeAreaView, TextField } from '@/shared/ui';
import {
  AuthApiError,
  createClass,
  createClassInvite,
  createOrganization,
  fetchEntitlement,
  listClasses,
  useAuth,
  type ClassResponse,
  type EntitlementResponse,
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
 */
export function OrganizationSignupPage() {
  const { state } = useAuth();

  if (state.status === 'loading') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }
  if (state.status === 'authenticated' && state.user.role === 'DIRECTOR') {
    return state.user.organizationId ? (
      <ClassManagementStep token={state.token} organizationId={state.user.organizationId} />
    ) : (
      <CreateOrganizationStep token={state.token} />
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

function CreateOrganizationStep({ token }: { token: string }) {
  const navigate = useNavigate();
  const { setSession, logout } = useAuth();
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
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.content}>
        <AccountLinkRow onMyPage={() => navigate('/mypage')} onLogout={logout} />
        <Text style={styles.title}>기관 및 단체 등록</Text>
        <Text style={styles.body}>거의 다 됐어요. 기관 및 단체 이름을 알려주세요.</Text>
        <TextField label="기관 및 단체 이름" value={name} onChangeText={setName} errorText={error ?? undefined} />
        <ActionButton
          label="등록하기"
          loading={submitting}
          onPress={onSubmit}
          disabled={!name.trim()}
        />
      </View>
    </SafeAreaView>
  );
}

function ClassManagementStep({ token, organizationId }: { token: string; organizationId: string }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
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
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.content}>
        <AccountLinkRow onMyPage={() => navigate('/mypage')} onLogout={logout} />
        <Text style={styles.title}>반 관리</Text>

        {entitlement && (
          <View style={[styles.subscriptionCard, !entitlement.grantsAccess && styles.subscriptionCardWarning]}>
            <Text style={styles.subscriptionLabel}>{SUBSCRIPTION_LABEL[entitlement.subscriptionStatus]}</Text>
            {!entitlement.grantsAccess && (
              <Text style={styles.subscriptionWarningBody}>
                지금은 아이들이 이야기를 시작할 수 없어요. 구독을 갱신해 주세요.
              </Text>
            )}
          </View>
        )}

        <View style={styles.card}>
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

        <Text style={styles.sectionLabel}>등록된 반</Text>
        {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
        {classes?.length === 0 ? <Text style={styles.body}>아직 등록된 반이 없어요.</Text> : null}
        {classes?.map((classGroup) => (
          <View key={classGroup.id} style={styles.card}>
            <Text style={styles.cardTitle}>{classGroup.name}</Text>
            <Text style={styles.body}>반 코드: {classGroup.joinCode}</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F1FB',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexGrow: 1,
    gap: 16,
    paddingHorizontal: 32,
    paddingVertical: 40,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#43225F',
    textAlign: 'center',
    marginBottom: 8,
  },
  subscriptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#EDE3F6',
    borderWidth: 1,
    borderColor: '#D9C7EC',
  },
  subscriptionCardWarning: {
    backgroundColor: '#FBEAE3',
    borderColor: '#F0C3AE',
  },
  subscriptionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#43225F',
  },
  subscriptionWarningBody: {
    fontSize: 12,
    color: '#B24E2E',
    fontWeight: '400',
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#43225F',
    marginTop: 8,
  },
  body: {
    fontSize: 14,
    color: '#6B5478',
  },
  error: {
    fontSize: 13,
    color: '#E46647',
  },
  card: {
    gap: 10,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0D3EA',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E1B3D',
  },
  inviteUrl: {
    fontSize: 12,
    color: '#7A4FA0',
  },
});
