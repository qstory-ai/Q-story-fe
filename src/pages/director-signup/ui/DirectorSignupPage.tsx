import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, SafeAreaView, TextField } from '@/shared/ui';
import {
  AuthApiError,
  createClass,
  createClassInvite,
  createOrganization,
  listClasses,
  signupDirector,
  useAuth,
  type ClassResponse,
} from '@/entities/auth';

/**
 * One page, three steps driven by auth state - not three routes, since a director always
 * progresses signup -> create organization -> manage classes in that fixed order and never
 * needs to revisit an earlier step once past it.
 */
export function DirectorSignupPage() {
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
    return <WrongRoleNotice />;
  }
  return <SignupStep />;
}

function SignupStep() {
  const { setSession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      const response = await signupDirector({ email: email.trim(), password, displayName: displayName.trim() });
      setSession(response.token, response.user);
    } catch (failure) {
      setError(failure instanceof AuthApiError ? failure.message : '가입하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }, [email, password, displayName, setSession]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>유치원 원장 가입</Text>
        <TextField label="이메일" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <TextField label="비밀번호" value={password} onChangeText={setPassword} secureTextEntry />
        <TextField
          label="이름"
          value={displayName}
          onChangeText={setDisplayName}
          errorText={error ?? undefined}
        />
        <ActionButton
          label={submitting ? '가입 중…' : '가입하기'}
          onPress={onSubmit}
          disabled={submitting || !email.trim() || !password || !displayName.trim()}
        />
      </View>
    </SafeAreaView>
  );
}

function CreateOrganizationStep({ token }: { token: string }) {
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
      setError(failure instanceof AuthApiError ? failure.message : '유치원을 등록하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }, [token, name, setSession]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>유치원 등록</Text>
        <Text style={styles.body}>거의 다 됐어요. 유치원 이름을 알려주세요.</Text>
        <TextField label="유치원 이름" value={name} onChangeText={setName} errorText={error ?? undefined} />
        <ActionButton
          label={submitting ? '등록 중…' : '등록하기'}
          onPress={onSubmit}
          disabled={submitting || !name.trim()}
        />
      </View>
    </SafeAreaView>
  );
}

function ClassManagementStep({ token, organizationId }: { token: string; organizationId: string }) {
  const [classes, setClasses] = useState<ClassResponse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [initialPassword, setInitialPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [inviteByClassId, setInviteByClassId] = useState<Record<string, string>>({});

  const reload = useCallback(() => {
    listClasses(token, organizationId)
      .then(setClasses)
      .catch((failure) =>
        setLoadError(failure instanceof AuthApiError ? failure.message : '반 목록을 불러오지 못했어요.'),
      );
  }, [token, organizationId]);

  useEffect(reload, [reload]);

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
        const shareUrl = `${globalThis.location?.origin ?? ''}/join?invite=${invite.token}`;
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
        <Text style={styles.title}>반 관리</Text>

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
            label={submitting ? '만드는 중…' : '반 만들기'}
            onPress={onCreateClass}
            disabled={submitting || !name.trim() || !initialPassword}
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

function WrongRoleNotice() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/', { replace: true });
  }, [navigate]);
  return null;
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
    fontWeight: '900',
    color: '#43225F',
    textAlign: 'center',
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '800',
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
    fontWeight: '800',
    color: '#2E1B3D',
  },
  inviteUrl: {
    fontSize: 12,
    color: '#7A4FA0',
  },
});
