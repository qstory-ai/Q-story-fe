import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { ActionButton, Checkbox, RadioGroup, SafeAreaView, StatusBanner, TextField, storybookTheme } from '@/shared/ui';
import { AuthApiError, homePathFor, joinClass, signupOrganizationOwner, signupParent, useAuth } from '@/entities/auth';

type SignupRole = 'DIRECTOR' | 'PARENT';

function roleFromParam(value: string | null): SignupRole | null {
  if (value === 'organization') return 'DIRECTOR';
  if (value === 'parent') return 'PARENT';
  return null;
}

/**
 * 역할에 따라 분기하는 단일 가입 화면 - 기존에 분리되어 있던 /director, /join 진입점을
 * 대체한다. 초대 링크는 항상 PARENT를 의미하며 토글을 잠그는데, 이는 ClassService.
 * resolveClassGroup()의 XOR 요구사항(classCode/inviteToken 중 정확히 하나만)과 일치한다.
 * 초대 링크가 없는 PARENT는 "우리 아이 반이 있어요" 체크박스로 joinClass()(반 코드)와
 * signupParent()(반 없는 독립 학부모) 중 하나를 고른다 - JoinClassPage와 같은 패턴이다.
 */
export function SignupPage() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const roleLocked = Boolean(inviteToken);

  const [role, setRole] = useState<SignupRole | null>(
    inviteToken ? 'PARENT' : roleFromParam(searchParams.get('role')),
  );
  const [hasClass, setHasClass] = useState(true);
  const [classCode, setClassCode] = useState('');
  const [loginId, setLoginId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const useJoinFlow = Boolean(inviteToken) || hasClass;
  const showClassCodeField = role === 'PARENT' && !inviteToken && hasClass;
  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const onSubmit = useCallback(async () => {
    if (!role) return;
    if (password !== confirmPassword) {
      setError('비밀번호가 서로 달라요.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const input = { loginId: loginId.trim(), email: email.trim(), password, displayName: displayName.trim() };
      if (role === 'DIRECTOR') {
        const response = await signupOrganizationOwner(input);
        setSession(response.token, response.user);
        navigate(homePathFor(response.user), { replace: true });
      } else {
        const response = useJoinFlow
          ? await joinClass({
              ...(inviteToken ? { inviteToken } : { classCode: classCode.trim().toUpperCase() }),
              ...input,
            })
          : await signupParent(input);
        setSession(response.token, response.user);
        navigate(homePathFor(response.user), { replace: true });
      }
    } catch (failure) {
      setError(failure instanceof AuthApiError ? failure.message : '가입하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }, [role, inviteToken, useJoinFlow, classCode, loginId, email, password, confirmPassword, displayName, navigate, setSession]);

  const canSubmit =
    role !== null &&
    Boolean(loginId.trim()) &&
    Boolean(email.trim()) &&
    Boolean(password) &&
    password === confirmPassword &&
    Boolean(displayName.trim()) &&
    (showClassCodeField ? classCode.trim().length > 0 : true);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">회원가입</Text>

        <RadioGroup
          accessibilityLabel="가입 유형"
          options={[
            { value: 'DIRECTOR', label: '기관 및 단체', disabled: roleLocked },
            { value: 'PARENT', label: '학부모', disabled: roleLocked },
          ]}
          value={role}
          onChange={(next) => setRole(next as SignupRole)}
        />

        {role === null ? <Text style={styles.body}>가입 유형을 선택해 주세요.</Text> : null}

        {role === 'PARENT' &&
          (inviteToken ? (
            <Text style={styles.body}>초대 링크로 반이 확인됐어요.</Text>
          ) : (
            <>
              <Checkbox checked={hasClass} onChange={setHasClass} label="우리 아이 반이 있어요" />
              {hasClass ? (
                <TextField
                  label="반 코드"
                  value={classCode}
                  onChangeText={setClassCode}
                  autoCapitalize="characters"
                  placeholder="선생님께 받은 코드"
                />
              ) : (
                <Text style={styles.body}>반 코드 없이 학부모 계정만 만들어요.</Text>
              )}
            </>
          ))}

        {role !== null ? (
          <View style={styles.card}>
            <TextField label="아이디" value={loginId} onChangeText={setLoginId} placeholder="로그인에 쓸 아이디" />
            <TextField label="이메일" value={email} onChangeText={setEmail} keyboardType="email-address" />
            <TextField label="비밀번호" value={password} onChangeText={setPassword} secureTextEntry />
            <TextField
              label="비밀번호 확인"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              errorText={passwordMismatch ? '비밀번호가 서로 달라요.' : undefined}
            />
            <TextField label="이름" value={displayName} onChangeText={setDisplayName} />
            {error ? <StatusBanner variant="warning" label={error} /> : null}
            <ActionButton
              label="가입하기"
              loading={submitting}
              onPress={onSubmit}
              disabled={!canSubmit}
            />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: storybookTheme.color.shellBackground,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 32,
    paddingVertical: 40,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: storybookTheme.type.lg,
    fontWeight: '700',
    color: storybookTheme.color.onLightHeading,
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.onLightBody,
  },
  card: {
    gap: 16,
    padding: 24,
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceWhite,
    borderWidth: 1,
    borderColor: storybookTheme.color.lightCardBorder,
    ...storybookTheme.elevation.low,
  },
});
